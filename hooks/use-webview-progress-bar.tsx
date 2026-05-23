import { useMemo, useRef } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import type { WebViewProgressEvent } from "react-native-webview/lib/WebViewTypes";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

const FADE_IN_MS = 120;
const PROGRESS_MS = 180;
const COMPLETE_MS = 120;
const FADE_OUT_MS = 280;

/**
 * WebView 顶部 2px 加载进度条。
 * 用法：
 *   const bar = useWebViewProgressBar();
 *   <WebView
 *     onLoadStart={bar.onLoadStart}
 *     onLoadProgress={bar.onLoadProgress}
 *     onLoadEnd={bar.onLoadEnd}
 *   />
 *   {bar.node}
 */
export function useWebViewProgressBar() {
  const scheme = useColorScheme();
  const tint = Colors[scheme === "dark" ? "dark" : "light"].tint;

  const progress = useSharedValue(0);
  const opacity = useSharedValue(0);
  // 区分"加载中"与"已结束"，防止 onLoadEnd 之后迟到的 onLoadProgress
  // 取消已经排好的淡出动画，使进度条卡在屏幕顶部
  const loadingRef = useRef(true);

  const handlers = useMemo(
    () => ({
      onLoadStart: () => {
        loadingRef.current = true;
        progress.value = 0;
        opacity.value = withTiming(1, { duration: FADE_IN_MS });
      },
      onLoadProgress: (e: WebViewProgressEvent) => {
        if (!loadingRef.current) return;
        progress.value = withTiming(e.nativeEvent.progress, {
          duration: PROGRESS_MS,
        });
      },
      onLoadEnd: () => {
        loadingRef.current = false;
        progress.value = withTiming(1, { duration: COMPLETE_MS });
        opacity.value = withDelay(
          COMPLETE_MS,
          withTiming(0, { duration: FADE_OUT_MS }, (done) => {
            if (done) progress.value = 0;
          }),
        );
      },
    }),
    [progress, opacity],
  );

  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
    opacity: opacity.value,
  }));

  const node = (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2 }}
    >
      <Animated.View
        style={[{ height: "100%", backgroundColor: tint }, barStyle]}
      />
    </View>
  );

  return { ...handlers, node };
}
