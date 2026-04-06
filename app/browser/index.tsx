import { useLocalSearchParams, useNavigation } from "expo-router";
import { useLayoutEffect, useRef } from "react";
import { View } from "react-native";
import {
  WebView,
  type WebViewMessageEvent,
  type WebViewNavigation,
} from "react-native-webview";

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
  const { onLoadEnd: autoLoginOnLoadEnd } = useZhlgdAutoLogin(webview);

  useLayoutEffect(() => {
    navigation.setOptions({ title: uri.split("/").pop() });
  }, [navigation, uri]);

  const onNavigationStateChange = (navState: WebViewNavigation) => {
    if (navState.title) {
      navigation.setOptions({ title: navState.title });
    }
  };

  const onMessage = async (event: WebViewMessageEvent) => {
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
        injectedJavaScriptBeforeContentLoaded={NATIVE_RPC_INJECTED_JAVASCRIPT}
        onNavigationStateChange={onNavigationStateChange}
        onLoadEnd={autoLoginOnLoadEnd}
        onMessage={onMessage}
      />
    </View>
  );
}
