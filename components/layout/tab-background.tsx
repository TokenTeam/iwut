import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { DEFAULT_SCHEDULE_VISUAL, useScheduleStore } from "@/store/schedule";

/**
 * 首页/功能页的全屏背景图。
 * 固定使用默认透明度与模糊值，不受“课表外观”里的滑杆设置影响；
 * 顶部叠一层向下消隐的底色渐变，保证状态栏与页面标题区域清晰。
 */
export function TabBackground() {
  const backgroundImageUri = useScheduleStore((s) => s.backgroundImageUri);
  const isDark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();

  if (!backgroundImageUri) return null;

  const scrimColor = isDark ? "21,23,24" : "255,255,255";

  return (
    <>
      <Image
        source={{ uri: backgroundImageUri }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: DEFAULT_SCHEDULE_VISUAL.backgroundImageOpacity,
        }}
        contentFit="cover"
        blurRadius={DEFAULT_SCHEDULE_VISUAL.backgroundImageBlurRadius}
      />
      <LinearGradient
        colors={[
          `rgba(${scrimColor},0.85)`,
          `rgba(${scrimColor},0.35)`,
          `rgba(${scrimColor},0)`,
        ]}
        locations={[0, 0.55, 1]}
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: insets.top + 150,
        }}
      />
    </>
  );
}
