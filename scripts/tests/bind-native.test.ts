import { describe, expect, mock, test } from "bun:test";
import { persist } from "zustand/middleware";
import { createStore, type StoreApi } from "zustand/vanilla";

import { loadBindDeclarations, loadTsDeclarations } from "./bind-test-helpers";

interface BindState {
  isBound: boolean;
  studentId: string;
  studentName: string;
  cardId: string;
  college: string;
  eduLevel: string;
  bind: (...args: string[]) => Promise<void>;
  getCredentials: () => Promise<{ username: string; password: string } | null>;
}

type PageEvent = {
  nativeEvent: {
    url: string;
    statusCode?: number;
    code?: number;
    description?: string;
    domain?: string;
  };
  preventDefault: () => void;
};

type WebViewProps = {
  key: number;
  source: { uri: string };
  ref: (
    view: {
      injectJavaScript: (script: string) => void;
      clearCache: (all: boolean) => void;
    } | null,
  ) => void;
  onLoadEnd: () => void;
  onMessage: (event: { nativeEvent: { data: string } }) => Promise<void>;
  onError: (event: PageEvent) => void;
  onHttpError: (event: PageEvent) => void;
};

type ElementNode = {
  type: unknown;
  props: Record<string, unknown>;
  children: ElementNode[];
};

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function makeStore(
  writePassword: (
    key: string,
    password: string,
  ) => Promise<void> = async () => {},
) {
  const secureWrite = mock(writePassword);
  const persistWrite = mock(() => {});
  const cookies = { clearAll: mock(async () => {}) };
  const { useUserBindStore: store } = loadTsDeclarations<{
    useUserBindStore: StoreApi<BindState>;
  }>("store/user-bind.ts", ["useUserBindStore"], {
    create: () => createStore,
    persist,
    zustandStorage: {
      getItem: () => null,
      setItem: persistWrite,
      removeItem: () => {},
    },
    SecureStore: {
      setItemAsync: secureWrite,
      getItemAsync: async () => "test-password",
      deleteItemAsync: async () => {},
    },
    CookieManager: cookies,
  });
  return { store, secureWrite, persistWrite, cookies };
}

/** Render the real screen with isolated hook/UI adapters; no app modules are mocked globally. */
function mountBindScreen(
  options: {
    writePassword?: (key: string, password: string) => Promise<void>;
    canGoBack?: boolean;
  } = {},
) {
  const user = makeStore(options.writePassword);
  const hooks: unknown[] = [];
  let hook = 0;
  const cleanups: (() => void)[] = [];
  const toast = mock((_value: Record<string, unknown>) => {});
  const report = mock(
    (_error: unknown, _context?: Record<string, unknown>) => {},
  );
  const reset = mock(() => {});
  const router = {
    canGoBack: () => options.canGoBack !== false,
    back: mock(() => {}),
    replace: mock((_route: unknown) => {}),
  };
  const views: {
    injectJavaScript: ReturnType<typeof mock<(script: string) => void>>;
    clearCache: ReturnType<typeof mock<(all: boolean) => void>>;
  }[] = [];
  const { BindScreen } = loadBindDeclarations<{
    BindScreen: () => ElementNode;
  }>(["BindScreen"], {
    React: {
      createElement: (
        type: unknown,
        props: Record<string, unknown> | null,
        ...children: ElementNode[]
      ) => ({ type, props: props ?? {}, children }),
    },
    useRef: <T>(initial: T) => {
      const index = hook++;
      hooks[index] ??= { current: initial };
      return hooks[index];
    },
    useState: <T>(initial: T) => {
      const index = hook++;
      hooks[index] ??= { value: initial };
      const slot = hooks[index] as { value: T };
      return [
        slot.value,
        (value: T) => {
          slot.value = value;
        },
      ];
    },
    useCallback: <T>(callback: T) => {
      hook++;
      return callback;
    },
    useEffect: (effect: () => void | (() => void)) => {
      const index = hook++;
      if (!hooks[index]) {
        hooks[index] = true;
        const cleanup = effect();
        if (cleanup) cleanups.push(cleanup);
      }
    },
    useMarkRouteInteractive: () => {},
    useT: () => (key: string) => key,
    useUserBindStore: user.store,
    useOnboardingStore: { getState: () => ({ reset }) },
    CookieManager: user.cookies,
    logger: { extend: () => ({ info: () => {} }) },
    reportError: report,
    router,
    Toast: { show: toast },
    StackScreenContent: "container",
    View: "view",
    Stack: { Screen: "screen" },
    WebView: "webview",
    IS_DEV: false,
  });
  const findWebView = (node: ElementNode): WebViewProps | undefined => {
    if (node.type === "webview") return node.props as unknown as WebViewProps;
    return node.children.map(findWebView).find(Boolean);
  };
  let props: WebViewProps | undefined;
  const render = () => {
    hook = 0;
    const next = findWebView(BindScreen());
    if (!next) throw new Error("BindScreen did not render its WebView");
    if (!props || next.key !== props.key) {
      props?.ref(null);
      const view = {
        injectJavaScript: mock((_script: string) => {}),
        clearCache: mock((_all: boolean) => {}),
      };
      views.push(view);
      next.ref(view);
    }
    props = next;
    return next;
  };
  render();
  return {
    ...user,
    toast,
    report,
    reset,
    router,
    views,
    render,
    get props() {
      return props!;
    },
    send: (message: Record<string, unknown>, target = props!) =>
      target.onMessage({ nativeEvent: { data: JSON.stringify(message) } }),
    unmount: () => {
      props?.ref(null);
      cleanups.forEach((cleanup) => cleanup());
    },
  };
}

const credentials = {
  type: "credentials",
  username: "typed-account",
  password: "test-password",
};
const info = {
  type: "info",
  studentId: "server-student-id",
  name: "Test user",
  cardId: "",
  college: "",
  eduLevel: "",
};
const rootUrl = "https://talent.whut.edu.cn/";
function pageEvent(
  url: string,
  extra: Partial<PageEvent["nativeEvent"]> = {},
): PageEvent {
  return { nativeEvent: { url, ...extra }, preventDefault: mock(() => {}) };
}

describe("binding native screen", () => {
  test.each([false, true])(
    "profileUnavailable preserves session without binding (identityUnavailable=%s)",
    async (identityUnavailable) => {
      const screen = mountBindScreen();
      await screen.send(credentials);
      await screen.send({ type: "profileUnavailable", identityUnavailable });
      await screen.send(info);
      await screen.send({ type: "bindingFailed" });
      expect(screen.secureWrite).not.toHaveBeenCalled();
      expect(screen.store.getState().isBound).toBe(false);
      expect(screen.reset).toHaveBeenCalledTimes(1);
      expect(screen.router.replace).toHaveBeenCalledTimes(1);
      expect(screen.router.replace).toHaveBeenCalledWith({
        pathname: "/onboarding",
        params: { step: "setup" },
      });
      expect(screen.router.back).not.toHaveBeenCalled();
      expect(screen.toast).toHaveBeenCalledTimes(1);
      expect(screen.toast.mock.calls[0]?.[0].text1).toBe(
        identityUnavailable
          ? "user.bindIdentityUnavailable"
          : "user.bindProfileUnavailable",
      );
      screen.unmount();
      expect(screen.cookies.clearAll).not.toHaveBeenCalled();
    },
  );

  test("binding waits for SecureStore, preserves identity mapping, and ignores duplicate terminal messages", async () => {
    const write = deferred();
    const screen = mountBindScreen({ writePassword: () => write.promise });
    await screen.send(credentials);
    const completion = screen.send(info);
    expect(screen.secureWrite).toHaveBeenCalledTimes(1);
    expect(screen.secureWrite).toHaveBeenCalledWith(
      "zhlgd_password",
      "test-password",
    );
    expect(screen.store.getState().isBound).toBe(false);
    expect(screen.persistWrite).not.toHaveBeenCalled();
    expect(screen.router.back).not.toHaveBeenCalled();
    await screen.send(info);
    await screen.send({ type: "profileUnavailable" });
    await screen.send({ type: "bindingFailed" });
    write.resolve();
    await completion;
    expect(screen.secureWrite).toHaveBeenCalledTimes(1);
    expect(screen.store.getState()).toMatchObject({
      isBound: true,
      studentId: "typed-account",
      studentName: "Test user",
      cardId: "",
      college: "",
      eduLevel: "",
    });
    expect(screen.router.back).toHaveBeenCalledTimes(1);
    expect(screen.toast.mock.calls[0]?.[0].type).toBe("success");
    expect(JSON.stringify(screen.persistWrite.mock.calls)).not.toContain(
      "test-password",
    );
    screen.unmount();
    expect(screen.cookies.clearAll).not.toHaveBeenCalled();
  });

  test("missing captured credentials ends with feedback rather than leaving info pending", async () => {
    const screen = mountBindScreen();
    await screen.send(info);
    expect(screen.secureWrite).not.toHaveBeenCalled();
    expect(screen.store.getState().isBound).toBe(false);
    expect(screen.toast.mock.calls[0]?.[0]).toMatchObject({
      type: "error",
      text2: "user.bindCredentialsUnavailable",
    });
    expect(screen.router.back).toHaveBeenCalledTimes(1);
    await screen.send(credentials);
    await screen.send(info);
    expect(screen.secureWrite).not.toHaveBeenCalled();
    screen.unmount();
    expect(screen.cookies.clearAll).toHaveBeenCalledTimes(1);
    expect(screen.cookies.clearAll).toHaveBeenCalledWith(true);
  });

  test("SecureStore rejection reports and exits without persisting or preserving the session", async () => {
    const failure = new Error("SecureStore unavailable");
    const screen = mountBindScreen({
      writePassword: async () => {
        throw failure;
      },
    });
    await screen.send(credentials);
    await screen.send(info);
    expect(screen.store.getState().isBound).toBe(false);
    expect(screen.persistWrite).not.toHaveBeenCalled();
    expect(screen.report).toHaveBeenCalledWith(
      failure,
      expect.objectContaining({ module: "bind" }),
    );
    expect(screen.toast.mock.calls[0]?.[0]).toMatchObject({
      type: "error",
      text2: "user.bindSaveFailed",
    });
    expect(screen.router.back).toHaveBeenCalledTimes(1);
    await screen.send(info);
    expect(screen.secureWrite).toHaveBeenCalledTimes(1);
    screen.unmount();
    expect(screen.cookies.clearAll).toHaveBeenCalledTimes(1);
    expect(screen.cookies.clearAll).toHaveBeenCalledWith(true);
  });

  test("bare-root 404 recovers once, preserves credentials, and rejects old WebView callbacks", async () => {
    const screen = mountBindScreen();
    const old = screen.props;
    await screen.send(credentials);
    old.onHttpError(pageEvent(rootUrl, { statusCode: 404 }));
    const recovered = screen.render();
    expect(recovered.key).toBe(1);
    expect(recovered.source.uri).toBe(
      `${rootUrl}information-center/center/index.html?appId=2`,
    );
    expect(screen.cookies.clearAll).not.toHaveBeenCalled();
    expect(screen.views[0]?.clearCache).toHaveBeenCalledTimes(1);
    expect(screen.views[0]?.clearCache).toHaveBeenCalledWith(true);
    old.onLoadEnd();
    await screen.send({ ...credentials, username: "stale-account" }, old);
    await screen.send(info, old);
    await screen.send({ type: "profileUnavailable" }, old);
    old.onHttpError(pageEvent(rootUrl, { statusCode: 500 }));
    const staleError = pageEvent(rootUrl, { code: -8 });
    old.onError(staleError);
    expect(staleError.preventDefault).toHaveBeenCalled();
    expect(screen.views[1]?.injectJavaScript).not.toHaveBeenCalled();
    expect(screen.report).not.toHaveBeenCalled();
    expect(screen.toast).not.toHaveBeenCalled();
    expect(screen.secureWrite).not.toHaveBeenCalled();
    recovered.onLoadEnd();
    expect(screen.views[1]?.injectJavaScript).toHaveBeenCalledTimes(1);
    await screen.send(info);
    expect(screen.store.getState().studentId).toBe("typed-account");
    screen.unmount();
    expect(screen.cookies.clearAll).not.toHaveBeenCalled();
  });

  test("Android root response error prevents the default error view and does not loop recovery", () => {
    const screen = mountBindScreen();
    const event = pageEvent(rootUrl, {
      description: "net::ERR_HTTP_RESPONSE_CODE_FAILURE",
      code: -1,
    });
    screen.props.onError(event);
    expect(event.preventDefault).toHaveBeenCalled();
    screen.render();
    screen.props.onHttpError(pageEvent(rootUrl, { statusCode: 404 }));
    expect(screen.render().key).toBe(1);
    expect(screen.router.back).toHaveBeenCalledTimes(1);
    expect(screen.toast.mock.calls[0]?.[0].type).toBe("error");
    screen.unmount();
    expect(screen.cookies.clearAll).toHaveBeenCalledTimes(1);
    expect(screen.cookies.clearAll).toHaveBeenCalledWith(true);
  });

  test.each([
    `${rootUrl}?ticket=test-ticket`,
    `${rootUrl}information-center/center/index.html?appId=2`,
  ])("does not recover HTTP 404 for %s", (url) => {
    const screen = mountBindScreen();
    screen.props.onHttpError(pageEvent(url, { statusCode: 404 }));
    expect(screen.render().key).toBe(0);
    expect(screen.router.back).toHaveBeenCalledTimes(1);
    screen.unmount();
    expect(screen.cookies.clearAll).toHaveBeenCalledTimes(1);
    expect(screen.cookies.clearAll).toHaveBeenCalledWith(true);
  });

  test("diagnostics remain nonterminal and normal user exit clears the session", async () => {
    const screen = mountBindScreen();
    await screen.send({
      type: "diagnostic",
      endpoint: "studentInfo",
      kind: "invalid-response",
      reason: "student-response",
      attempt: 1,
    });
    expect(screen.report).toHaveBeenCalledTimes(1);
    expect(screen.toast).not.toHaveBeenCalled();
    expect(screen.router.back).not.toHaveBeenCalled();
    expect(screen.router.replace).not.toHaveBeenCalled();
    screen.unmount();
    expect(screen.cookies.clearAll).toHaveBeenCalledTimes(1);
    expect(screen.cookies.clearAll).toHaveBeenCalledWith(true);
  });

  test.each([false, true])(
    "unmount ignores callbacks and late save completion (reject=%s)",
    async (reject) => {
      const write = deferred();
      const screen = mountBindScreen({ writePassword: () => write.promise });
      await screen.send(credentials);
      const saving = screen.send(info);
      screen.unmount();
      screen.props.onLoadEnd();
      screen.props.onHttpError(pageEvent(rootUrl, { statusCode: 404 }));
      await screen.send({ type: "profileUnavailable" });
      await screen.send(info);
      if (reject) write.reject(new Error("Save failed after leaving"));
      else write.resolve();
      await saving;
      expect(screen.secureWrite).toHaveBeenCalledTimes(1);
      expect(screen.router.back).not.toHaveBeenCalled();
      expect(screen.router.replace).not.toHaveBeenCalled();
      expect(screen.toast).not.toHaveBeenCalled();
      expect(screen.views[0]?.injectJavaScript).not.toHaveBeenCalled();
      expect(screen.cookies.clearAll).toHaveBeenCalledTimes(1);
    },
  );
});

describe("precise recovery URL recognition", () => {
  const { isRecoverableTalentRootError } = loadBindDeclarations<{
    isRecoverableTalentRootError: (
      failure: PageEvent["nativeEvent"],
    ) => boolean;
  }>(["isRecoverableTalentRootError"]);

  test.each([
    { url: rootUrl, statusCode: 404, recover: true },
    {
      url: rootUrl,
      description: "net::ERR_HTTP_RESPONSE_CODE_FAILURE",
      recover: true,
    },
    {
      url: rootUrl,
      statusCode: 500,
      description: "net::ERR_HTTP_RESPONSE_CODE_FAILURE",
      recover: false,
    },
    { url: `${rootUrl}?ticket=test-ticket`, statusCode: 404, recover: false },
    { url: "http://talent.whut.edu.cn/", statusCode: 404, recover: false },
    {
      url: "https://talent.whut.edu.cn.evil.example/",
      statusCode: 404,
      recover: false,
    },
    {
      url: "https://user:password@talent.whut.edu.cn/",
      statusCode: 404,
      recover: false,
    },
  ])(
    "recognizes only the allowed root failure: %j",
    ({ recover, ...failure }) => {
      expect(isRecoverableTalentRootError(failure)).toBe(recover);
    },
  );
});
