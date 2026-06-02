import { useLocalSearchParams, useNavigation } from "expo-router";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Linking, Platform, View } from "react-native";
import Toast from "react-native-toast-message";
import {
  WebView,
  type WebViewMessageEvent,
  type WebViewNavigation,
} from "react-native-webview";
import type {
  ShouldStartLoadRequest,
  WebViewErrorEvent,
  WebViewNavigationEvent,
} from "react-native-webview/lib/WebViewTypes";

import { IS_DEV } from "@/constants/is-dev";
import { useWebViewBackHandler } from "@/hooks/use-webview-back-handler";
import { useWebViewProgressBar } from "@/hooks/use-webview-progress-bar";
import { useZhlgdAutoLogin } from "@/hooks/use-zhlgd-autologin";
import { useT } from "@/lib/i18n";
import {
  NATIVE_RPC_INJECTED_JAVASCRIPT,
  NativeRPCBridge,
} from "@/lib/nativerpc";

// 允许 WebView 自己加载的 scheme
const BLANK_WEBVIEW_URL = "about:blank";
const IN_WEBVIEW_SCHEMES = ["http:", "https:", "data:", "file:"];

export default function BrowserScreen() {
  const t = useT();
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const navigation = useNavigation();
  const webview = useRef<WebView>(null);
  const rpcBridge = useRef<NativeRPCBridge>(new NativeRPCBridge());
  const [canGoBack, setCanGoBack] = useState(false);
  const {
    onLoadEnd: autoLoginOnLoadEnd,
    onMessage: autoLoginOnMessage,
    smsNode,
  } = useZhlgdAutoLogin(webview);
  const progressBar = useWebViewProgressBar();

  useWebViewBackHandler(webview, canGoBack);

  useLayoutEffect(() => {
    navigation.setOptions({ title: uri.split("/").pop() });
  }, [navigation, uri]);

  // 离开浏览器时清空 WebView 的 HTTP 缓存
  useEffect(() => {
    const currentWebView = webview.current;
    return () => {
      currentWebView?.clearCache(true);
    };
  }, []);

  const onNavigationStateChange = (navState: WebViewNavigation) => {
    if (navState.url.toLowerCase() === BLANK_WEBVIEW_URL) return;

    setCanGoBack(navState.canGoBack);
    if (navState.title) {
      navigation.setOptions({ title: navState.title });
    }
  };

  // 非 http(s) 等浏览器 scheme 一律转交给系统，避免 WebView 自己报错
  const onShouldStartLoadWithRequest = useCallback(
    (request: ShouldStartLoadRequest) => {
      const { url } = request;
      if (url.toLowerCase() === BLANK_WEBVIEW_URL) return false;

      const urlScheme = url.match(/^[a-z][a-z0-9+\-.]*:/i)?.[0]?.toLowerCase();
      if (urlScheme === "about:") return false;
      if (!urlScheme || IN_WEBVIEW_SCHEMES.includes(urlScheme)) return true;

      Linking.openURL(url).catch(() => {
        Toast.show({
          type: "error",
          text1: t("browser.externalOpenFailed"),
          text2: t("browser.externalOpenFailedSub", { scheme: urlScheme }),
          position: "bottom",
        });
      });
      return false;
    },
    [t],
  );

  const onLoadEnd = (e: WebViewNavigationEvent | WebViewErrorEvent) => {
    autoLoginOnLoadEnd(e);
    progressBar.onLoadEnd();
  };

  const onMessage = async (event: WebViewMessageEvent) => {
    if (autoLoginOnMessage(event)) return;

    const response = await rpcBridge.current.handleRawMessage(
      event.nativeEvent.data,
      { pageUrl: event.nativeEvent.url },
    );

    if (!response) return;

    webview.current?.injectJavaScript(
      rpcBridge.current.buildDeliverScript(response),
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <WebView
        ref={webview}
        source={{ uri }}
        style={{ flex: 1 }}
        javaScriptEnabled
        originWhitelist={["*"]}
        webviewDebuggingEnabled={IS_DEV}
        injectedJavaScriptBeforeContentLoaded={NATIVE_RPC_INJECTED_JAVASCRIPT}
        allowsBackForwardNavigationGestures={Platform.OS === "ios" && canGoBack}
        pullToRefreshEnabled
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        onNavigationStateChange={onNavigationStateChange}
        onLoadStart={progressBar.onLoadStart}
        onLoadProgress={progressBar.onLoadProgress}
        onLoadEnd={onLoadEnd}
        onMessage={onMessage}
      />
      {progressBar.node}
      {smsNode}
    </View>
  );
}
