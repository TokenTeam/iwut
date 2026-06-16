import { router, Stack } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Toast from "react-native-toast-message";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { IS_DEV } from "@/constants/is-dev";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";
import { useZhlgdAutoLogin } from "@/hooks/use-zhlgd-autologin";
import { t as translate, useT } from "@/lib/i18n";
import { reportError } from "@/lib/report";
import {
  buildExamFetchScript,
  EXAM_APP_PREFIX,
  EXAM_LOGIN_URL,
  isExamRowsMessage,
  normalizeExamRowsMessage,
} from "@/services/exam-import";
import { useExamStore } from "@/store/exam";

const PROGRESS_STRIPES = Array.from({ length: 24 }, (_, i) => i);
const PROGRESS_STRIPE_WIDTH = 12;
const PROGRESS_STRIPE_GAP = 10;
const PROGRESS_STRIPE_PERIOD = PROGRESS_STRIPE_WIDTH + PROGRESS_STRIPE_GAP;

export default function ExamImportScreen() {
  useMarkRouteInteractive();
  const t = useT();
  const webview = useRef<WebView>(null);
  const injected = useRef(false);
  const finished = useRef(false);
  const injectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = useCallback(
    (success: boolean, message?: string, count?: number) => {
      if (finished.current) return;
      finished.current = true;
      webview.current?.clearCache(true);
      injected.current = false;

      if (success) {
        Toast.show({
          type: "success",
          text1: t("exam.importSuccess"),
          text2:
            typeof count === "number"
              ? t("exam.importSuccessSub", { n: count })
              : undefined,
          position: "bottom",
        });
      } else {
        Toast.show({
          type: "error",
          text1: t("exam.importFail"),
          text2: message || t("exam.importFailSub"),
          position: "bottom",
        });
      }

      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/exam");
      }
    },
    [t],
  );

  const {
    onLoadEnd: autoLoginOnLoadEnd,
    onMessage: autoLoginOnMessage,
    sms,
    smsNode,
  } = useZhlgdAutoLogin(webview, {
    onCancel: () => finish(false, t("course.smsCancelled")),
  });

  const stripeProgress = useSharedValue(0);

  useEffect(() => {
    stripeProgress.value = withRepeat(
      withTiming(1, { duration: 650, easing: Easing.linear }),
      -1,
      false,
    );
  }, [stripeProgress]);

  const stripeStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          stripeProgress.value,
          [0, 1],
          [-PROGRESS_STRIPE_PERIOD, 0],
        ),
      },
    ],
  }));

  useEffect(() => {
    const currentWebView = webview.current;
    return () => {
      if (injectTimer.current) clearTimeout(injectTimer.current);
      currentWebView?.clearCache(true);
      if (!finished.current) {
        finished.current = true;
        Toast.show({
          type: "error",
          text1: translate("exam.importFail"),
          text2: translate("exam.importCancelled"),
          position: "bottom",
        });
      }
    };
  }, []);

  useEffect(() => {
    if (sms.visible) return;
    const timeout = setTimeout(() => {
      if (!injected.current) {
        finish(false, t("exam.importTimeout"));
      }
    }, 30000);
    return () => clearTimeout(timeout);
  }, [sms.visible, finish, t]);

  const handleError = useCallback(
    (syntheticEvent: {
      nativeEvent: { description: string; url?: string; code?: number };
    }) => {
      const { description, url, code } = syntheticEvent.nativeEvent;
      reportError(new Error(description), {
        module: "exam-import",
        webviewUrl: url,
        webviewCode: code,
      });
      finish(false, t("exam.importFailSub"));
    },
    [finish, t],
  );

  const handleLoadEnd = useCallback(
    (e: { nativeEvent: { url: string } }) => {
      autoLoginOnLoadEnd(e);
      if (injected.current) return;

      const url = e.nativeEvent.url;
      if (url.startsWith(EXAM_APP_PREFIX)) {
        injected.current = true;
        const script = buildExamFetchScript({
          fetchUserFailed: t("exam.fetchUserFailed"),
          importTimeout: t("exam.importTimeout"),
        });
        injectTimer.current = setTimeout(() => {
          if (!finished.current) webview.current?.injectJavaScript(script);
        }, 1500);
      }
    },
    [autoLoginOnLoadEnd, t],
  );

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      if (autoLoginOnMessage(event)) return;

      let msg: any;
      try {
        msg = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }

      if (msg?.type === "debug") {
        console.log("exam", msg.message);
        return;
      }

      if (msg?.type === "error") {
        const err = new Error(msg.message || "Load failed");
        if (msg.name) err.name = String(msg.name);
        if (msg.stack) err.stack = String(msg.stack);
        reportError(err, {
          module: "exam-import",
          webviewErrorName: msg.name,
          webviewErrorMessage: msg.message,
          webviewErrorStack: msg.stack,
          webviewUrl: msg.url,
        });
        finish(false, msg.message);
        return;
      }

      if (isExamRowsMessage(msg)) {
        const result = normalizeExamRowsMessage(msg);
        useExamStore.getState().setExamData(result);
        finish(true, undefined, result.exams.length);
      }
    },
    [autoLoginOnMessage, finish],
  );

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: t("exam.importTitle") }} />
      <WebView
        source={{ uri: EXAM_LOGIN_URL }}
        style={{ flex: 1 }}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        cacheEnabled={false}
        originWhitelist={["*"]}
        webviewDebuggingEnabled={IS_DEV}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        onHttpError={handleError}
        onMessage={handleMessage}
        ref={webview}
      />
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.72)",
        }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 28,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 320,
              borderRadius: 8,
              backgroundColor: "white",
              paddingHorizontal: 18,
              paddingBottom: 12,
              paddingTop: 28,
              alignItems: "center",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.22,
              shadowRadius: 18,
              elevation: 10,
            }}
          >
            <View
              style={{
                position: "absolute",
                top: -28,
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: "white",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <IconSymbol name="assignment" size={30} color="#111827" />
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <ActivityIndicator size="small" color="#178f8b" />
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "500",
                  color: "#111827",
                }}
              >
                {t("exam.importingWait")}
              </Text>
            </View>
            <View
              style={{
                width: "100%",
                height: 6,
                overflow: "hidden",
                backgroundColor: "#4b5563",
              }}
            >
              <Animated.View
                style={[
                  {
                    position: "absolute",
                    top: -9,
                    left: 0,
                    height: 24,
                    flexDirection: "row",
                  },
                  stripeStyle,
                ]}
              >
                {PROGRESS_STRIPES.map((stripe) => (
                  <View
                    key={stripe}
                    style={{
                      width: PROGRESS_STRIPE_WIDTH,
                      height: 28,
                      marginRight: PROGRESS_STRIPE_GAP,
                      backgroundColor: "#111827",
                      opacity: 0.5,
                      transform: [{ rotate: "30deg" }],
                    }}
                  />
                ))}
              </Animated.View>
            </View>
          </View>
        </View>
      </View>
      {smsNode}
    </View>
  );
}
