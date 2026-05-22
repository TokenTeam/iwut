import { useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useLayoutEffect, useRef } from "react";
import { View } from "react-native";
import {
  WebView,
  type WebViewMessageEvent,
  type WebViewNavigation,
} from "react-native-webview";

import { IS_DEV } from "@/constants/is-dev";
import { useZhlgdAutoLogin } from "@/hooks/use-zhlgd-autologin";
import {
  NATIVE_RPC_INJECTED_JAVASCRIPT,
  NativeRPCBridge,
} from "@/lib/nativerpc";

export default function BrowserScreen() {
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const navigation = useNavigation();
  const webview = useRef<WebView>(null);
  const rpcBridge = useRef<NativeRPCBridge>(new NativeRPCBridge());
  const {
    onLoadEnd: autoLoginOnLoadEnd,
    onMessage: autoLoginOnMessage,
    smsNode,
  } = useZhlgdAutoLogin(webview);

  useLayoutEffect(() => {
    navigation.setOptions({ title: uri.split("/").pop() });
  }, [navigation, uri]);

  // 离开浏览器时清空 WebView 的 HTTP 缓存
  useEffect(() => {
    return () => {
      webview.current?.clearCache(true);
    };
  }, []);

  const onNavigationStateChange = (navState: WebViewNavigation) => {
    if (navState.title) {
      navigation.setOptions({ title: navState.title });
    }
  };

  const onMessage = async (event: WebViewMessageEvent) => {
    if (autoLoginOnMessage(event)) return;

    const response = await rpcBridge.current.handleRawMessage(
      event.nativeEvent.data,
      { pageUrl: event.nativeEvent.url },
    );

    if (!response) {
      return;
    }

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
        onNavigationStateChange={onNavigationStateChange}
        onLoadEnd={autoLoginOnLoadEnd}
        onMessage={onMessage}
      />
      {smsNode}
    </View>
  );
}
