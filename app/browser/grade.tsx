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
  buildGradeFetchScript,
  GRADE_APP_PREFIX,
  GRADE_LOGIN_URL,
  isGradeRowsMessage,
  normalizeGradeRowsMessage,
} from "@/services/grade-import";
import { useGradeStore } from "@/store/grade";

const PROGRESS_STRIPES = Array.from({ length: 24 }, (_, index) => index);
const PROGRESS_STRIPE_WIDTH = 12;
const PROGRESS_STRIPE_GAP = 10;
const PROGRESS_STRIPE_PERIOD = PROGRESS_STRIPE_WIDTH + PROGRESS_STRIPE_GAP;

export default function GradeSyncScreen() {
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
          text1: t("grade.querySuccess"),
          text2:
            typeof count === "number"
              ? t("grade.querySuccessSub", { n: count })
              : undefined,
          position: "bottom",
        });
      } else {
        Toast.show({
          type: "error",
          text1: t("grade.queryFail"),
          text2: message || t("grade.queryFailSub"),
          position: "bottom",
        });
      }

      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/grade");
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
          text1: translate("grade.queryFail"),
          text2: translate("grade.queryCancelled"),
          position: "bottom",
        });
      }
    };
  }, []);

  useEffect(() => {
    if (sms.visible) return;
    const timeout = setTimeout(() => {
      if (!injected.current) finish(false, t("grade.queryTimeout"));
    }, 30000);
    return () => clearTimeout(timeout);
  }, [finish, sms.visible, t]);

  const handleError = useCallback(
    (syntheticEvent: {
      nativeEvent: { description: string; url?: string; code?: number };
    }) => {
      const { description, url, code } = syntheticEvent.nativeEvent;
      reportError(new Error(description), {
        module: "grade-query",
        webviewUrl: url,
        webviewCode: code,
      });
      finish(false, t("grade.queryFailSub"));
    },
    [finish, t],
  );

  const handleLoadEnd = useCallback(
    (event: { nativeEvent: { url: string } }) => {
      autoLoginOnLoadEnd(event);
      if (injected.current) return;

      if (event.nativeEvent.url.startsWith(GRADE_APP_PREFIX)) {
        injected.current = true;
        const script = buildGradeFetchScript({
          fetchFailed: t("grade.fetchFailed"),
          queryTimeout: t("grade.queryTimeout"),
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

      let message: unknown;
      try {
        message = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }

      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        message.type === "error"
      ) {
        const details = message as {
          message?: unknown;
          name?: unknown;
        };
        const error = new Error(
          details.message ? String(details.message) : "Load failed",
        );
        if (details.name) error.name = String(details.name);
        reportError(error, {
          module: "grade-query",
          webviewErrorName: details.name,
          webviewErrorMessage: details.message,
        });
        finish(false, details.message ? String(details.message) : undefined);
        return;
      }

      if (isGradeRowsMessage(message)) {
        const grades = normalizeGradeRowsMessage(message);
        useGradeStore.getState().replaceGrades(grades);
        finish(true, undefined, grades.length);
      }
    },
    [autoLoginOnMessage, finish],
  );

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: t("grade.queryTitle") }} />
      <WebView
        source={{ uri: GRADE_LOGIN_URL }}
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
          inset: 0,
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
              boxShadow: "0 8px 18px rgba(0, 0, 0, 0.22)",
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
                style={{ fontSize: 16, fontWeight: "500", color: "#111827" }}
              >
                {t("grade.queryingWait")}
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
