import { useFocusEffect, usePreventRemove } from "expo-router";
import { useCallback, type RefObject } from "react";
import { BackHandler, Platform } from "react-native";
import type { WebView } from "react-native-webview";

export function useWebViewBackHandler(
  ref: RefObject<WebView | null>,
  canGoBack: boolean,
) {
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (!canGoBack) return false;
        ref.current?.goBack();
        return true;
      });
      return () => sub.remove();
    }, [canGoBack, ref]),
  );

  usePreventRemove(canGoBack, () => ref.current?.goBack());
}
