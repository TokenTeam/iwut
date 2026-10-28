import { describe, expect, mock, test } from "bun:test";

import { loadBindDeclarations, loadTsDeclarations } from "./bind-test-helpers";

type Reporter = (raw: unknown) => void;
type ReportError = (error: unknown, context?: Record<string, unknown>) => void;
type SentryEvent = {
  exception?: { values?: { type: string; value: string }[] };
};

function reportRuntime({ development = false, telemetry = true } = {}) {
  const local = mock(
    (_error: unknown, _context?: Record<string, unknown>) => {},
  );
  const capture = mock((_error: unknown, _context?: unknown) => {});
  const { isNetworkError } = loadTsDeclarations<{
    isNetworkError: (error: unknown) => boolean;
  }>("lib/network-error.ts", ["isNetworkError"]);
  const telemetryStore = { getState: () => ({ enabled: telemetry }) };
  const { reportError } = loadTsDeclarations<{ reportError: ReportError }>(
    "lib/report.ts",
    ["reportError"],
    {
      logger: { extend: () => ({ error: local }) },
      Sentry: { captureException: capture },
      isNetworkError,
      useTelemetryStore: telemetryStore,
      __DEV__: development,
    },
  );
  const { createBindErrorReporter } = loadBindDeclarations<{
    createBindErrorReporter: (report: ReportError) => Reporter;
  }>(["createBindErrorReporter"]);
  return {
    local,
    capture,
    isNetworkError,
    reportError,
    report: createBindErrorReporter(reportError),
    createBindErrorReporter,
    telemetryStore,
  };
}

describe("binding diagnostics and report filtering", () => {
  test("forwards only whitelisted diagnostic metadata, without response contents or credentials", () => {
    const runtime = reportRuntime();
    runtime.report({
      endpoint: "studentInfo",
      kind: "invalid-response",
      reason: "student-fields",
      responseType: "object",
      dataType: "object",
      expandFieldType: "array",
      status: false,
      statusCode: 200,
      attempt: 8,
      code: 50000,
      username: "private-username",
      password: "private-password",
      cookie: "private-cookie",
      url: "https://talent.whut.edu.cn/?ticket=private-ticket",
      message: "private-response",
      data: { name: "private-name" },
      domain: "private-domain",
      unknown: "private-extra",
    });
    expect(runtime.capture).toHaveBeenCalledTimes(1);
    expect(runtime.local.mock.calls[0]?.[1]).toEqual({
      module: "bind",
      endpoint: "studentInfo",
      kind: "invalid-response",
      reason: "student-fields",
      responseType: "object",
      dataType: "object",
      expandFieldType: "array",
      status: false,
      statusCode: 200,
      attempt: 8,
      code: 50000,
    });
    expect(JSON.stringify(runtime.capture.mock.calls)).not.toContain(
      "private-",
    );
    expect(runtime.capture.mock.calls[0]?.[1]).toEqual({
      tags: { module: "bind" },
      extra: runtime.local.mock.calls[0]?.[1],
    });
  });

  test("rejects unknown endpoints/kinds and unsafe metadata without consuming valid diagnostics", () => {
    const runtime = reportRuntime();
    for (const value of [
      null,
      "error",
      {},
      { endpoint: "private-user", kind: "http" },
      { endpoint: "studentInfo", kind: "private-kind" },
    ]) {
      runtime.report(value);
    }
    expect(runtime.local).not.toHaveBeenCalled();
    runtime.report({
      endpoint: "studentInfo",
      kind: "invalid-response",
      reason: "private-response",
      responseType: "function",
      dataType: "private-data",
      expandFieldType: "symbol",
      status: "true",
      statusCode: "200",
      attempt: Number.MAX_SAFE_INTEGER + 1,
      code: 1.5,
    });
    expect(runtime.local.mock.calls[0]?.[1]).toEqual({
      module: "bind",
      endpoint: "studentInfo",
      kind: "invalid-response",
    });
  });

  test("deduplicates each endpoint while giving network failures a separate key", () => {
    const runtime = reportRuntime();
    runtime.report({ endpoint: "studentInfo", kind: "network" });
    runtime.report({ endpoint: "studentInfo", kind: "network" });
    runtime.report({
      endpoint: "studentInfo",
      kind: "invalid-response",
      attempt: 8,
    });
    runtime.report({ endpoint: "studentInfo", kind: "http", statusCode: 503 });
    runtime.report({ endpoint: "loginUser", kind: "http", statusCode: 500 });
    expect(runtime.local).toHaveBeenCalledTimes(3);
    expect(runtime.capture).toHaveBeenCalledTimes(2);
    expect(runtime.local.mock.calls[0]?.[0]).toMatchObject({
      code: "NETWORK_FAILURE",
    });
    expect(runtime.local.mock.calls[1]?.[1]).toMatchObject({
      endpoint: "studentInfo",
      kind: "invalid-response",
      attempt: 8,
    });
    const nextScreen = runtime.createBindErrorReporter(runtime.reportError);
    nextScreen({ endpoint: "studentInfo", kind: "invalid-response" });
    expect(runtime.capture).toHaveBeenCalledTimes(3);
  });

  test.each([
    { development: true, telemetry: true },
    { development: false, telemetry: false },
  ])(
    "keeps local diagnostics but respects telemetry configuration: %j",
    (options) => {
      const runtime = reportRuntime(options);
      runtime.report({ endpoint: "studentInfo", kind: "invalid-response" });
      expect(runtime.local).toHaveBeenCalledTimes(1);
      expect(runtime.capture).not.toHaveBeenCalled();
    },
  );

  test.each([
    { code: -2, domain: undefined, sentry: false },
    { code: -8, domain: undefined, sentry: false },
    { code: -11, domain: undefined, sentry: true },
    { code: -1009, domain: "NSURLErrorDomain", sentry: false },
    { code: -1200, domain: "NSURLErrorDomain", sentry: true },
  ])(
    "classifies WebView load errors through the real network filter: %j",
    ({ code, domain, sentry }) => {
      const runtime = reportRuntime();
      runtime.report({ endpoint: "talentPage", kind: "load", code, domain });
      expect(runtime.local.mock.calls[0]?.[0]).toMatchObject({
        name: "WebViewLoadError",
        code,
      });
      if (domain)
        expect(runtime.local.mock.calls[0]?.[0]).toHaveProperty(
          "domain",
          domain,
        );
      expect(runtime.capture).toHaveBeenCalledTimes(sentry ? 1 : 0);
    },
  );

  test("HTTP failures stay reportable and unknown native domains are not forwarded", () => {
    const runtime = reportRuntime();
    runtime.report({
      endpoint: "talentPage",
      kind: "load",
      code: -1200,
      domain: "untrusted-domain",
    });
    runtime.report({ endpoint: "studentInfo", kind: "http", statusCode: 503 });
    expect(runtime.capture).toHaveBeenCalledTimes(2);
    expect(runtime.local.mock.calls[0]?.[0]).not.toHaveProperty("domain");
    expect(runtime.local.mock.calls[0]?.[1]).not.toHaveProperty("domain");
  });

  test("root Sentry beforeSend keeps telemetry and network filtering as a second boundary", () => {
    const runtime = reportRuntime();
    let telemetryEnabled = true;
    let beforeSend!: (
      event: SentryEvent,
      hint: { originalException?: unknown },
    ) => SentryEvent | null;
    loadTsDeclarations("app/_layout.tsx", [], {
      __DEV__: false,
      SENTRY_DSN: "test-dsn",
      Updates: { channel: "test" },
      t: (key: string) => key,
      isNetworkError: runtime.isNetworkError,
      useTelemetryStore: { getState: () => ({ enabled: telemetryEnabled }) },
      Sentry: {
        init: (options: { beforeSend: typeof beforeSend }) => {
          beforeSend = options.beforeSend;
        },
        feedbackIntegration: () => ({}),
        wrap: (value: unknown) => value,
      },
      Observe: { configure: () => {} },
      ObserveRoot: { wrap: (value: unknown) => value },
    });
    const diagnostic: SentryEvent = {
      exception: {
        values: [
          { type: "Error", value: "Bind studentInfo: invalid-response" },
        ],
      },
    };
    expect(beforeSend(diagnostic, {})).toBe(diagnostic);
    expect(
      beforeSend(diagnostic, {
        originalException: { code: "NETWORK_FAILURE" },
      }),
    ).toBeNull();
    expect(
      beforeSend(
        {
          exception: {
            values: [{ type: "TypeError", value: "Network request failed" }],
          },
        },
        {},
      ),
    ).toBeNull();
    telemetryEnabled = false;
    expect(beforeSend(diagnostic, {})).toBeNull();
  });
});
