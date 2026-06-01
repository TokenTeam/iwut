import { Ionicons } from "@expo/vector-icons";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Modal, Text, View } from "react-native";
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

import { IS_DEV } from "@/constants/is-dev";
import { useZhlgdAutoLogin } from "@/hooks/use-zhlgd-autologin";
import { useT } from "@/lib/i18n";
import { reportError } from "@/lib/report";
import {
  BACHELOR_HOME_PREFIX,
  BACHELOR_LOGIN_URL,
  buildBachelorFetchScript,
  isBachelorCoursesMessage,
  normalizeBachelorCoursesMessage,
} from "@/services/course-import/bachelor-import";
import {
  buildMasterFetchScript,
  isMasterRowsMessage,
  MASTER_LOGIN_URL,
  MASTER_MAIN_PREFIX,
  normalizeMasterRowsMessage,
} from "@/services/course-import/master-import";
import { syncWidgetData } from "@/services/widget-sync";
import { type ImportType, useCourseStore } from "@/store/course";

export interface GetCourseHandle {
  startImport: (type: ImportType) => void;
}

export const GetCourse = forwardRef<GetCourseHandle>(
  function GetCourse(_, ref) {
    const t = useT();
    const [importing, setImporting] = useState(false);
    const [importType, setImportType] = useState<ImportType>("bachelor");
    const webview = useRef<WebView>(null);
    const injected = useRef(false);
    const finishRef = useRef<(success: boolean, message?: string) => void>(
      () => {},
    );
    const {
      onLoadEnd: autoLoginOnLoadEnd,
      onMessage: autoLoginOnMessage,
      sms,
      smsNode,
    } = useZhlgdAutoLogin(webview, {
      onCancel: () => finishRef.current(false, t("course.smsCancelled")),
    });

    useImperativeHandle(ref, () => ({
      startImport(type: ImportType) {
        injected.current = false;
        setImportType(type);
        setImporting(true);
      },
    }));

    const iconPulse = useSharedValue(0);
    const ripple = useSharedValue(0);

    useEffect(() => {
      if (importing) {
        iconPulse.value = withRepeat(
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          -1,
          true,
        );
        ripple.value = 0;
        ripple.value = withRepeat(
          withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }),
          -1,
          false,
        );
      } else {
        iconPulse.value = 0;
        ripple.value = 0;
      }
    }, [importing, iconPulse, ripple]);

    const iconStyle = useAnimatedStyle(() => ({
      opacity: interpolate(iconPulse.value, [0, 0.5, 1], [0.7, 1, 0.7]),
    }));

    const rippleStyle = useAnimatedStyle(() => ({
      transform: [{ scale: interpolate(ripple.value, [0, 1], [1, 1.8]) }],
      opacity: interpolate(ripple.value, [0, 0.4, 1], [0.4, 0.15, 0]),
    }));

    const finish = useCallback(
      (success: boolean, message?: string) => {
        // 在 WebView 被卸载前清理 HTTP 缓存
        webview.current?.clearCache(true);
        setImporting(false);
        injected.current = false;
        if (success) {
          Toast.show({
            type: "success",
            text1: t("course.importSuccess"),
            text2: t("course.importSuccessSub"),
            position: "bottom",
          });
        } else {
          Toast.show({
            type: "error",
            text1: t("course.importFail"),
            text2: message || t("course.importFailSub"),
            position: "bottom",
          });
        }
      },
      [t],
    );
    finishRef.current = finish;

    useEffect(() => {
      if (!importing || sms.visible) return;
      const timeout = setTimeout(() => {
        if (!injected.current) {
          finish(false, t("course.importTimeout"));
        }
      }, 30000);
      return () => clearTimeout(timeout);
    }, [importing, sms.visible, finish, t]);

    const handleError = useCallback(
      (syntheticEvent: {
        nativeEvent: { description: string; url?: string; code?: number };
      }) => {
        const { description, url, code } = syntheticEvent.nativeEvent;
        reportError(new Error(description), {
          module: `course-${importType}`,
          webviewUrl: url,
          webviewCode: code,
        });
        finish(false, t("course.importFailSub"));
      },
      [importType, finish, t],
    );

    const handleLoadEnd = useCallback(
      (e: { nativeEvent: { url: string } }) => {
        autoLoginOnLoadEnd(e);
        if (injected.current) return;

        const url = e.nativeEvent.url;

        if (importType === "bachelor" && url.startsWith(BACHELOR_HOME_PREFIX)) {
          injected.current = true;
          const script = buildBachelorFetchScript({
            fetchUserFailed: t("course.fetchUserFailed"),
            noTermData: t("course.noTermData"),
          });
          setTimeout(() => {
            webview.current?.injectJavaScript(script);
          }, 1500);
        }

        if (importType === "master" && url.startsWith(MASTER_MAIN_PREFIX)) {
          injected.current = true;
          const script = buildMasterFetchScript({
            fetchUserFailed: t("course.fetchUserFailed"),
          });
          setTimeout(() => {
            webview.current?.injectJavaScript(script);
          }, 1500);
        }
      },
      [autoLoginOnLoadEnd, importType, t],
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
          console.log(importType, msg.message);
          return;
        }

        if (msg?.type === "error") {
          const err = new Error(msg.message || "Load failed");
          if (msg.name) err.name = String(msg.name);
          if (msg.stack) err.stack = String(msg.stack);
          reportError(err, {
            module: `course-${importType}`,
            webviewErrorName: msg.name,
            webviewErrorMessage: msg.message,
            webviewErrorStack: msg.stack,
            webviewUrl: msg.url,
          });
          finish(false, msg.message);
          return;
        }

        if (isMasterRowsMessage(msg)) {
          const { courses, term, termStart } = normalizeMasterRowsMessage(msg);

          if (courses.length === 0) {
            finish(false, t("course.noTermData").replace("{term}", term));
            return;
          }

          const store = useCourseStore.getState();
          store.setImportedCourses(courses);
          if (termStart) store.setTermStart(termStart);
          syncWidgetData().catch(() => {});
          finish(true);
          return;
        }

        if (isBachelorCoursesMessage(msg)) {
          const { courses, termStart } = normalizeBachelorCoursesMessage(msg);

          if (courses.length === 0) {
            finish(false, t("course.parseFailed"));
            return;
          }

          const store = useCourseStore.getState();
          store.setImportedCourses(courses);
          if (termStart) store.setTermStart(termStart);
          syncWidgetData().catch(() => {});
          finish(true);
          return;
        }
      },
      [importType, finish, autoLoginOnMessage, t],
    );

    if (!importing) return null;

    const loginUrl =
      importType === "bachelor" ? BACHELOR_LOGIN_URL : MASTER_LOGIN_URL;

    return (
      <Modal
        visible
        transparent
        animationType="fade"
        onRequestClose={() => finish(false, t("course.importCancelled"))}
      >
        <View style={{ flex: 1 }}>
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.45)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <View
              style={{
                backgroundColor: "white",
                borderRadius: 20,
                paddingHorizontal: 36,
                paddingVertical: 28,
                alignItems: "center",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 8,
              }}
            >
              <View
                style={{
                  width: 72,
                  height: 72,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Animated.View
                  style={[
                    {
                      position: "absolute",
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      backgroundColor: "#3b82f6",
                    },
                    rippleStyle,
                  ]}
                />
                <Animated.View style={iconStyle}>
                  <Ionicons
                    name="cloud-download-outline"
                    size={36}
                    color="#3b82f6"
                  />
                </Animated.View>
              </View>
              <Text
                style={{
                  marginTop: 14,
                  fontSize: 16,
                  fontWeight: "600",
                  color: "#1f2937",
                }}
              >
                {t("course.importing")}
              </Text>
              <Text
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  color: "#9ca3af",
                }}
              >
                {t("course.importingSub")}
              </Text>
            </View>
          </View>
          <View
            style={{
              position: "absolute",
              left: -9999,
              top: 0,
              width: 390,
              height: 844,
            }}
            pointerEvents="none"
          >
            <WebView
              source={{ uri: loginUrl }}
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
          </View>
          {smsNode}
        </View>
      </Modal>
    );
  },
);
