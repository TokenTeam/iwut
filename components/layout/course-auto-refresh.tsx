import { useSegments } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { IS_DEV } from "@/constants/is-dev";
import { useZhlgdAutoLogin } from "@/hooks/use-zhlgd-autologin";
import { t } from "@/lib/i18n";
import { logger } from "@/lib/logger";
import {
  canApplyAutoRefresh,
  canAutoRefreshCourses,
  type CourseImportOrigin,
} from "@/services/course-import/auto-refresh";
import {
  buildCourseFetchScript,
  getCourseImportPage,
  normalizeCourseImportMessage,
} from "@/services/course-import/webview-import";
import { type Course, useCourseStore } from "@/store/course";
import { useSettingsStore } from "@/store/settings";
import { useUserBindStore } from "@/store/user-bind";

const log = logger.extend("CourseAutoRefresh");
const TIMEOUT_MS = 45000;

interface RefreshRun {
  startedAt: number;
  origin: CourseImportOrigin;
  courses: Course[];
  termStart: string;
}

export function CourseAutoRefresh() {
  const segments = useSegments();
  const enabled = useSettingsStore((s) => s.autoRefreshCourses);
  const isBound = useUserBindStore((s) => s.isBound);
  const studentId = useUserBindStore((s) => s.studentId);
  const origin = useCourseStore((s) => s.importOrigin);
  const manualImportActive = useCourseStore((s) => s.manualImportActive);
  const [appState, setAppState] = useState(AppState.currentState);
  const [run, setRun] = useState<RefreshRun | null>(null);
  const attemptedThisOpen = useRef(false);
  const allowed =
    Platform.OS !== "web" &&
    enabled &&
    isBound &&
    segments[0] === "(tabs)" &&
    appState === "active" &&
    !manualImportActive;

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") attemptedThisOpen.current = false;
      setAppState(state);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!allowed) return;
    const timer = setTimeout(() => {
      const store = useCourseStore.getState();
      const user = useUserBindStore.getState();
      const eligible = canAutoRefreshCourses({
        enabled: useSettingsStore.getState().autoRefreshCourses,
        isBound: user.isBound,
        studentId: user.studentId,
        origin: store.importOrigin,
        lastSuccessAt: store.lastAutoRefreshSuccessAt,
        now: Date.now(),
      });
      if (
        AppState.currentState !== "active" ||
        attemptedThisOpen.current ||
        store.manualImportActive ||
        !store.termStart ||
        !eligible ||
        !store.importOrigin
      ) {
        log.debug("skip auto refresh", {
          eligible,
          attemptedThisOpen: attemptedThisOpen.current,
          hasTermStart: !!store.termStart,
        });
        return;
      }
      // 不循环重试，失败后下次打开仍可刷新
      attemptedThisOpen.current = true;
      setRun({
        startedAt: Date.now(),
        origin: store.importOrigin,
        courses: store.courses,
        termStart: store.termStart,
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [allowed, origin, studentId]);

  const finish = useCallback(() => setRun(null), []);
  if (
    run &&
    (!allowed || run.origin !== origin || run.origin.studentId !== studentId)
  ) {
    setRun(null);
    return null;
  }
  if (!allowed || !run) return null;
  return <RefreshWebView run={run} onFinish={finish} />;
}

function RefreshWebView({
  run,
  onFinish,
}: {
  run: RefreshRun;
  onFinish: () => void;
}) {
  const webview = useRef<WebView>(null);
  const finished = useRef(false);
  const injected = useRef(false);
  const injectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentUrl = useRef("");
  const stage = useRef<"login" | "course" | "fetch">("login");
  const page = getCourseImportPage(run.origin.type);
  const finish = useCallback(
    (reason: string, details?: Record<string, string | number | boolean>) => {
      if (finished.current) return;
      finished.current = true;
      if (injectTimer.current) clearTimeout(injectTimer.current);
      webview.current?.stopLoading();
      log.info("finished", {
        reason,
        type: run.origin.type,
        elapsedMs: Date.now() - run.startedAt,
        stage: stage.current,
        ...details,
      });
      onFinish();
    },
    [onFinish, run.origin.type, run.startedAt],
  );
  const needsInteraction = useCallback(
    () => finish("interaction-required"),
    [finish],
  );
  const credentialsUnavailable = useCallback(
    () => finish("credentials-unavailable"),
    [finish],
  );
  const { onLoadEnd: autoLoginOnLoadEnd, onMessage: autoLoginOnMessage } =
    useZhlgdAutoLogin(webview, {
      silent: true,
      onPasswordError: needsInteraction,
      onInteractionRequired: needsInteraction,
      onCredentialsUnavailable: credentialsUnavailable,
    });

  useEffect(() => {
    log.info("started", { type: run.origin.type, platform: Platform.OS });
    const timer = setTimeout(() => finish("timeout"), TIMEOUT_MS);
    return () => {
      clearTimeout(timer);
      if (injectTimer.current) clearTimeout(injectTimer.current);
      if (!finished.current) {
        finished.current = true;
        log.info("finished", {
          reason: "cancelled",
          type: run.origin.type,
          stage: stage.current,
          elapsedMs: Date.now() - run.startedAt,
        });
      }
    };
  }, [finish, run.origin.type, run.startedAt]);

  const onLoadEnd = useCallback(
    (event: { nativeEvent: { url: string } }) => {
      if (finished.current) return;
      autoLoginOnLoadEnd(event);
      currentUrl.current = event.nativeEvent.url;
      if (injectTimer.current) clearTimeout(injectTimer.current);
      if (injected.current || !currentUrl.current.startsWith(page.homePrefix))
        return;
      const url = currentUrl.current;
      injectTimer.current = setTimeout(() => {
        if (finished.current || injected.current || currentUrl.current !== url)
          return;
        injected.current = true;
        stage.current = "fetch";
        webview.current?.injectJavaScript(
          buildCourseFetchScript(run.origin.type, {
            fetchUserFailed: t("course.fetchUserFailed"),
            noTermData: t("course.noTermData"),
          }),
        );
      }, 1500);
    },
    [autoLoginOnLoadEnd, page.homePrefix, run.origin.type],
  );

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      if (finished.current || autoLoginOnMessage(event)) return;
      let message: unknown;
      try {
        message = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }
      if (!event.nativeEvent.url.startsWith(page.homePrefix)) return;
      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        message.type === "error"
      ) {
        finish(
          "script-error",
          "code" in message && typeof message.code === "string"
            ? { code: message.code }
            : undefined,
        );
        return;
      }
      const result = normalizeCourseImportMessage(run.origin.type, message);
      if (!result) return;
      const store = useCourseStore.getState();
      const user = useUserBindStore.getState();
      if (
        AppState.currentState !== "active" ||
        !useSettingsStore.getState().autoRefreshCourses ||
        !user.isBound ||
        user.studentId !== run.origin.studentId ||
        store.importOrigin !== run.origin ||
        store.manualImportActive ||
        !canApplyAutoRefresh({
          previousCourses: run.courses,
          currentCourses: store.courses,
          previousTermStart: run.termStart,
          currentTermStart: store.termStart,
          incomingTermStart: result.termStart,
          incomingCourses: result.courses,
        })
      ) {
        finish("result-discarded", {
          count: result.courses.length,
          termMatches: result.termStart === run.termStart,
          coursesChanged: store.courses !== run.courses,
        });
        return;
      }
      store.applyImportedCourses(result.courses, result.termStart, run.origin);
      useCourseStore.setState({ lastAutoRefreshSuccessAt: Date.now() });
      finish("success", { count: result.courses.length });
    },
    [autoLoginOnMessage, finish, page.homePrefix, run],
  );

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      collapsable={false}
      style={StyleSheet.absoluteFill}
    >
      {/* 保持 WKWebView 全尺寸挂载，用不透明内容遮挡 */}
      <WebView
        ref={webview}
        source={{ uri: page.loginUrl }}
        style={{ flex: 1 }}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        cacheEnabled={false}
        originWhitelist={["*"]}
        webviewDebuggingEnabled={IS_DEV}
        onLoadEnd={onLoadEnd}
        onLoadStart={(event) => {
          currentUrl.current = event.nativeEvent.url;
          if (injectTimer.current) clearTimeout(injectTimer.current);
          stage.current = currentUrl.current.startsWith(page.homePrefix)
            ? "course"
            : "login";
        }}
        onMessage={onMessage}
        onError={(event) => {
          finish("load-error", { code: event.nativeEvent.code });
        }}
        onHttpError={(event) => {
          finish("http-error", {
            statusCode: event.nativeEvent.statusCode,
          });
        }}
        onContentProcessDidTerminate={() => finish("web-content-terminated")}
        onRenderProcessGone={() => finish("render-process-gone")}
        onShouldStartLoadWithRequest={(request) => {
          if (request.url === "about:blank") return true;
          try {
            const url = new URL(request.url);
            return (
              url.protocol === "https:" && url.hostname.endsWith(".whut.edu.cn")
            );
          } catch {
            return false;
          }
        }}
      />
    </View>
  );
}
