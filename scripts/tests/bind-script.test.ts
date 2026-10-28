import { describe, expect, test } from "bun:test";
import { createContext, runInContext } from "node:vm";

import { loadBindDeclarations } from "./bind-test-helpers";

const { INJECTED_JS } = loadBindDeclarations<{ INJECTED_JS: string }>([
  "INJECTED_JS",
]);

type Endpoint = "loginUser" | "studentInfo" | "colleges" | "education";
type Message = { type: string; [key: string]: unknown };
interface Reply {
  body?: unknown;
  status?: number;
  network?: boolean;
  invalidJson?: boolean;
}
type ReplyPlan = Reply | ((attempt: number) => Reply | Promise<Reply>);

const identity = {
  code: 0,
  data: { sn: "TEST-STUDENT", name: "Test Student" },
};
const fullProfile = {
  code: 0,
  status: true,
  data: {
    expandField: {
      基本信息: [{ fieldCode: "card_no", fieldValue: "TEST-CARD" }],
      学籍信息: [
        { fieldCode: "education_code", fieldValue: "TEST-EDU" },
        { fieldCode: "college_code", fieldValue: "TEST-COLLEGE" },
      ],
    },
  },
};
const timeoutProfile = {
  code: 50000,
  status: false,
  data: null,
  message: "登录超时",
};
const emptyInfo = {
  type: "info",
  name: "Test Student",
  studentId: "TEST-STUDENT",
  cardId: "",
  college: "",
  eduLevel: "",
};
const fullInfo = {
  ...emptyInfo,
  cardId: "TEST-CARD",
  college: "Test College",
  eduLevel: "Test Education",
};

function endpointFor(url: string): Endpoint {
  if (url.includes("getLoginUserNew")) return "loginUser";
  if (url.includes("findStudentInfoWechat")) return "studentInfo";
  if (url.includes("getColleges")) return "colleges";
  if (url.includes("getDictionByName")) return "education";
  throw new Error(`Unexpected test request: ${url}`);
}

function createPage(
  plans: Partial<Record<Endpoint, ReplyPlan>> = {},
  url = "https://talent.whut.edu.cn/information-center/center/index.html?appId=2",
) {
  const defaults: Record<Endpoint, Reply> = {
    loginUser: { body: identity },
    studentInfo: { body: fullProfile },
    colleges: {
      body: { code: 0, data: [{ sn: "TEST-COLLEGE", name: "Test College" }] },
    },
    education: {
      body: { code: 0, data: [{ code: "TEST-EDU", name: "Test Education" }] },
    },
  };
  const messages: Message[] = [];
  const requests: { endpoint: Endpoint; url: string; options: unknown }[] = [];
  const timers: { callback: () => void; delay: number }[] = [];
  const redirects: string[] = [];
  const pageWindow = {
    ReactNativeWebView: {
      postMessage: (value: string) => messages.push(JSON.parse(value)),
    },
  };
  const location = Object.assign(new URL(url), {
    replace: (value: string) => redirects.push(value),
  });
  const context = createContext({
    window: pageWindow,
    location,
    document: {},
    setTimeout: (callback: () => void, delay: number) => {
      timers.push({ callback, delay });
      return timers.length;
    },
    fetch: async (requestUrl: string, options: unknown) => {
      const endpoint = endpointFor(requestUrl);
      requests.push({ endpoint, url: requestUrl, options });
      const attempt = requests.filter(
        (item) => item.endpoint === endpoint,
      ).length;
      const plan = plans[endpoint] ?? defaults[endpoint];
      const reply = await (typeof plan === "function" ? plan(attempt) : plan);
      if (reply.network) throw new Error("Synthetic network failure");
      const status = reply.status ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => {
          if (reply.invalidJson)
            throw new SyntaxError("Synthetic invalid JSON");
          return reply.body;
        },
      };
    },
  });
  const inject = () => runInContext(INJECTED_JS, context);
  // A real event-loop turn drains the complete fetch/Promise.all/finally chain.
  // Fake retry timers are advanced only after that chain has settled.
  const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
  const takeTimer = () => {
    const timer = timers.shift();
    if (!timer) throw new Error("Expected a pending retry timer");
    expect(timer.delay).toBe(1000);
    return timer.callback;
  };
  const advance = async () => {
    takeTimer()();
    await settle();
  };
  const finish = async () => {
    await settle();
    for (let turn = 0; timers.length; turn++) {
      if (turn >= 10) throw new Error("Binding scheduled unbounded retries");
      await advance();
    }
  };
  const terminals = () =>
    messages.filter((message) =>
      ["info", "profileUnavailable", "bindingFailed"].includes(message.type),
    );
  const diagnostics = () =>
    messages.filter((message) => message.type === "diagnostic");
  const count = (endpoint: Endpoint) =>
    requests.filter((request) => request.endpoint === endpoint).length;
  inject();
  return {
    messages,
    requests,
    timers,
    redirects,
    inject,
    settle,
    takeTimer,
    advance,
    finish,
    terminals,
    diagnostics,
    count,
  };
}

function expectDiagnostic(
  page: ReturnType<typeof createPage>,
  endpoint: Endpoint,
  kind: string,
  reason?: string,
) {
  expect(page.diagnostics()).toContainEqual(
    expect.objectContaining({ endpoint, kind, ...(reason ? { reason } : {}) }),
  );
}

describe("production binding injection: successful and optional profiles", () => {
  test("keeps complete profile fields and expands the real template correctly", async () => {
    const page = createPage();
    await page.finish();
    expect(page.terminals()).toEqual([fullInfo]);
    expect(page.diagnostics()).toEqual([]);
    expect(page.count("loginUser")).toBe(1);
    expect(page.requests.find((r) => r.endpoint === "education")?.url).toBe(
      `/information-center/xd/commons/getDictionByName/${encodeURIComponent("学生类型")}`,
    );
    for (const request of page.requests) {
      expect(request.options).toEqual({
        credentials: "include",
        headers: { accept: "application/json" },
      });
    }
  });

  test.each([
    ["null", { expandField: null }],
    ["missing", {}],
    ["empty object", { expandField: {} }],
  ])(
    "successful %s expansion finishes on the first attempt",
    async (_, data) => {
      const page = createPage({
        studentInfo: { body: { code: 0, status: true, data } },
      });
      await page.finish();
      expect(page.terminals()).toEqual([emptyInfo]);
      expect(page.count("loginUser")).toBe(1);
      expect(page.diagnostics()).toEqual([]);
    },
  );

  test.each([2, 8])(
    "keeps recovered data on attempt %i",
    async (recoveryAttempt) => {
      const page = createPage({
        studentInfo: (attempt) =>
          attempt < recoveryAttempt ? { status: 503 } : { body: fullProfile },
      });
      await page.finish();
      expect(page.terminals()).toEqual([fullInfo]);
      expect(page.count("loginUser")).toBe(recoveryAttempt);
      expectDiagnostic(page, "studentInfo", "http");
    },
  );

  test.each([
    ["network", { network: true }],
    ["http", { status: 503 }],
    ["invalid-json", { invalidJson: true }],
    ["invalid-response", { body: { code: 0, data: "bad dictionary" } }],
  ] satisfies [string, Reply][])(
    "optional dictionary %s errors preserve binding",
    async (kind, reply) => {
      const page = createPage({ colleges: reply, education: reply });
      await page.finish();
      expect(page.terminals()).toEqual([{ ...emptyInfo, cardId: "TEST-CARD" }]);
      expect(page.count("loginUser")).toBe(1);
      expectDiagnostic(page, "colleges", kind);
      expectDiagnostic(page, "education", kind);
    },
  );
});

describe("production binding injection: student profile fallback", () => {
  test.each([
    ["network", { network: true }],
    ["http", { status: 503 }],
    ["invalid-json", { invalidJson: true }],
  ] satisfies [string, Reply][])(
    "persistent student %s errors retain current identity",
    async (kind, reply) => {
      const page = createPage({ studentInfo: reply });
      await page.finish();
      expect(page.terminals()).toEqual([emptyInfo]);
      expect(page.count("loginUser")).toBe(8);
      expect(page.count("studentInfo")).toBe(8);
      expectDiagnostic(page, "studentInfo", kind);
      expect(
        page.diagnostics().some((m) => m.reason === "student-response"),
      ).toBe(false);
      if (kind === "http") {
        expect(page.diagnostics()[0].statusCode).toBe(503);
      }
    },
  );

  test("persistent session timeout is diagnosed only at the final fallback", async () => {
    const page = createPage({ studentInfo: { body: timeoutProfile } });
    await page.settle();
    for (let attempt = 1; attempt < 8; attempt++) {
      expect(page.terminals()).toEqual([]);
      expect(page.diagnostics()).toEqual([]);
      await page.advance();
    }
    expect(page.terminals()).toEqual([emptyInfo]);
    expect(page.diagnostics()).toEqual([
      expect.objectContaining({ reason: "session-timeout", attempt: 8 }),
    ]);
    expect(page.messages.at(-1)).toEqual(emptyInfo);
    expect(page.timers).toHaveLength(0);
  });

  test("temporary session timeout recovers without a timeout diagnostic", async () => {
    const page = createPage({
      studentInfo: (attempt) => ({
        body: attempt < 3 ? timeoutProfile : fullProfile,
      }),
    });
    await page.finish();
    expect(page.terminals()).toEqual([fullInfo]);
    expect(page.count("studentInfo")).toBe(3);
    expect(page.diagnostics()).toEqual([]);
  });

  test.each([
    ["missing status", { code: 0, data: {} }],
    [
      "false status with empty expansion",
      { code: 0, status: false, data: { expandField: null } },
    ],
    [
      "nonzero code with empty expansion",
      { code: 123, status: true, data: { expandField: null } },
    ],
    ["missing code", { status: true, data: {} }],
    ["null data", { code: 0, status: true, data: null }],
    ["array data", { code: 0, status: true, data: [] }],
    ["null response", null],
  ])(
    "invalid student response (%s) retries before using empty fields",
    async (_, body) => {
      const page = createPage({ studentInfo: { body } });
      await page.finish();
      expect(page.count("studentInfo")).toBe(8);
      expect(page.terminals()).toEqual([emptyInfo]);
      expectDiagnostic(
        page,
        "studentInfo",
        "invalid-response",
        "student-response",
      );
    },
  );

  test.each([["invalid"], [[]], [42], [false]])(
    "rejects invalid expansion %j before falling back",
    async (expandField) => {
      const page = createPage({
        studentInfo: { body: { code: 0, status: true, data: { expandField } } },
      });
      await page.finish();
      expect(page.count("studentInfo")).toBe(8);
      expect(page.terminals()).toEqual([emptyInfo]);
      expectDiagnostic(page, "studentInfo", "invalid-response", "expand-field");
    },
  );

  test.each([
    { 基本信息: "invalid" },
    { 学籍信息: {} },
    { 基本信息: [null] },
    { 学籍信息: ["invalid"] },
  ])("rejects malformed field collections %j", async (expandField) => {
    const page = createPage({
      studentInfo: { body: { code: 0, status: true, data: { expandField } } },
    });
    await page.finish();
    expect(page.count("studentInfo")).toBe(8);
    expect(page.terminals()).toEqual([emptyInfo]);
    expectDiagnostic(page, "studentInfo", "invalid-response", "student-fields");
  });

  test("a parsing exception discards previously assigned fields", async () => {
    // This is a possible JSON value; String(value) throws after cardId was set.
    const expandField = {
      基本信息: fullProfile.data.expandField.基本信息,
      学籍信息: [
        {
          fieldCode: "education_code",
          fieldValue: { toString: null, valueOf: null },
        },
      ],
    };
    const page = createPage({
      studentInfo: { body: { code: 0, status: true, data: { expandField } } },
    });
    await page.finish();
    expect(page.terminals()).toEqual([emptyInfo]);
    expect(page.count("studentInfo")).toBe(8);
    expectDiagnostic(
      page,
      "studentInfo",
      "invalid-response",
      "student-parsing",
    );
  });

  test("fallback uses the identity returned in the final attempt", async () => {
    const page = createPage({
      loginUser: (attempt) => ({
        body: {
          code: 0,
          data: { sn: `TEST-${attempt}`, name: `Student ${attempt}` },
        },
      }),
      studentInfo: { network: true },
    });
    await page.finish();
    expect(page.terminals()).toEqual([
      { ...emptyInfo, studentId: "TEST-8", name: "Student 8" },
    ]);
  });
});

describe("production binding injection: identity failure and explicit unavailable", () => {
  test.each([
    ["network", { network: true }],
    ["http", { status: 503 }],
    ["invalid-json", { invalidJson: true }],
    ["invalid-response", { body: { code: 0, data: {} } }],
    ["invalid-response", { body: { code: 123, data: identity.data } }],
    ["invalid-response", { body: { code: 0, data: null } }],
  ] satisfies [string, Reply][])(
    "persistent identity %s failures allow setup without info",
    async (kind, reply) => {
      const page = createPage({ loginUser: reply });
      await page.finish();
      expect(page.terminals()).toEqual([
        { type: "profileUnavailable", identityUnavailable: true },
      ]);
      expect(page.count("loginUser")).toBe(8);
      expect(page.count("studentInfo")).toBe(0);
      expectDiagnostic(page, "loginUser", kind);
    },
  );

  test("an earlier valid identity cannot authorize fallback after final identity failure", async () => {
    const page = createPage({
      loginUser: (attempt) =>
        attempt < 8 ? { body: identity } : { network: true },
      studentInfo: { network: true },
    });
    await page.finish();
    expect(page.terminals()).toEqual([
      { type: "profileUnavailable", identityUnavailable: true },
    ]);
    expect(page.count("loginUser")).toBe(8);
    expect(page.count("studentInfo")).toBe(7);
    expectDiagnostic(page, "loginUser", "network");
  });

  test.each(["loginUser", "studentInfo"] as const)(
    "%s code 50005 retains its immediate setup path",
    async (endpoint) => {
      const page = createPage({ [endpoint]: { body: { code: 50005 } } });
      await page.finish();
      expect(page.terminals()).toEqual([{ type: "profileUnavailable" }]);
      expect(page.count("loginUser")).toBe(1);
      expect(page.diagnostics()).toEqual([]);
    },
  );
});

describe("production binding injection: lifecycle guards", () => {
  test("repeated injection cannot duplicate requests or completion", async () => {
    const page = createPage();
    for (let index = 0; index < 5; index++) page.inject();
    await page.finish();
    page.inject();
    await page.finish();
    expect(page.terminals()).toEqual([fullInfo]);
    for (const endpoint of [
      "loginUser",
      "studentInfo",
      "colleges",
      "education",
    ] as const) {
      expect(page.count(endpoint)).toBe(1);
    }
  });

  test("a pending student request keeps the full attempt locked and late retries are inert", async () => {
    let releaseStudent!: (reply: Reply) => void;
    const studentReply = new Promise<Reply>((resolve) => {
      releaseStudent = resolve;
    });
    const page = createPage({
      studentInfo: (attempt) =>
        attempt === 1 ? { status: 503 } : studentReply,
    });
    await page.settle();
    const retry = page.takeTimer();
    retry();
    await page.settle();
    expect(page.count("studentInfo")).toBe(2);
    retry();
    retry();
    page.inject();
    await page.settle();
    expect(page.count("loginUser")).toBe(2);
    expect(page.terminals()).toEqual([]);
    releaseStudent({ body: fullProfile });
    await page.finish();
    expect(page.terminals()).toEqual([fullInfo]);
    retry();
    page.inject();
    await page.finish();
    expect(page.count("loginUser")).toBe(2);
    expect(page.terminals()).toEqual([fullInfo]);
    expect(page.timers).toHaveLength(0);
  });

  test.each(["loginUser", "studentInfo"] as const)(
    "%s retry exhaustion produces one terminal and no further requests",
    async (endpoint) => {
      const page = createPage({ [endpoint]: { network: true } });
      await page.settle();
      const lateRetry = page.takeTimer();
      lateRetry();
      await page.finish();
      expect(page.terminals()).toHaveLength(1);
      expect(page.count("loginUser")).toBe(8);
      lateRetry();
      page.inject();
      await page.finish();
      expect(page.terminals()).toHaveLength(1);
      expect(page.count("loginUser")).toBe(8);
      expect(page.timers).toHaveLength(0);
    },
  );

  test("the talent root redirects through the interpolated application path only once", async () => {
    const page = createPage({}, "https://talent.whut.edu.cn/");
    page.inject();
    await page.finish();
    expect(page.redirects).toEqual([
      "/information-center/center/index.html?appId=2",
    ]);
    expect(page.requests).toEqual([]);
    expect(page.messages).toEqual([]);
  });

  test("unrelated origins do not run the binding script", async () => {
    const page = createPage({}, "https://unrelated.example/");
    await page.finish();
    expect(page.requests).toEqual([]);
    expect(page.messages).toEqual([]);
    expect(page.timers).toEqual([]);
  });
});
