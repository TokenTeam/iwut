import { useFocusEffect, usePreventRemove } from "expo-router";
import { useCallback, type RefObject } from "react";
import { BackHandler, Platform } from "react-native";
import type { WebView } from "react-native-webview";

/**
 * 让 WebView 屏幕的"返回"先消费 WebView 的浏览历史，翻到第一页时再放行给路由栈
 *
 * 覆盖的触发源：
 * - Android 硬件返回键 / 系统手势返回（BackHandler）
 * - Header 返回按钮、iOS 边缘滑动返回（navigation 的 beforeRemove 事件）
 */
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
