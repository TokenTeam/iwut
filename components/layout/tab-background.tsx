import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { DEFAULT_SCHEDULE_VISUAL, useScheduleStore } from "@/store/schedule";

/**
 * Tabs shared background. Mounted above the tab navigator so switching tabs
 * does not remount/reload the image layer.
 */
export function TabBackground() {
  const segments = useSegments();
  const backgroundImageUri = useScheduleStore((s) => s.backgroundImageUri);
  const backgroundImageOpacity = useScheduleStore(
    (s) => s.backgroundImageOpacity,
  );
  const backgroundImageBlurRadius = useScheduleStore(
    (s) => s.backgroundImageBlurRadius,
  );
  const isDark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();
  const isCourseTab = segments[0] === "(tabs)" && segments[1] === "course";

  if (!backgroundImageUri) return null;

  const scrimColor = isDark ? "21,23,24" : "255,255,255";
  const opacity = isCourseTab
    ? backgroundImageOpacity
    : DEFAULT_SCHEDULE_VISUAL.backgroundImageOpacity;
  const blurRadius = isCourseTab
    ? backgroundImageBlurRadius
    : DEFAULT_SCHEDULE_VISUAL.backgroundImageBlurRadius;

  return (
    <>
      <Image
        pointerEvents="none"
        source={{ uri: backgroundImageUri }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity,
        }}
        contentFit="cover"
        blurRadius={blurRadius}
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
