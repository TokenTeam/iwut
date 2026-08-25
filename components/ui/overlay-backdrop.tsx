import { BlurView } from "expo-blur";
import { Pressable, StyleSheet } from "react-native";

import {
  getAndroidBlurProps,
  type BlurTargetRef,
  useAndroidBlurTarget,
} from "@/components/ui/app-blur-target";
import { useColorScheme } from "@/hooks/use-color-scheme";

const blockPress = () => {};

export function OverlayBackdrop({
  blurTarget,
  onPress,
}: {
  blurTarget?: BlurTargetRef;
  onPress?: () => void;
}) {
  const isDark = useColorScheme() === "dark";
  const appBlurTarget = useAndroidBlurTarget();
  const resolvedBlurTarget = blurTarget ?? appBlurTarget;

  return (
    <>
      <BlurView
        {...getAndroidBlurProps(resolvedBlurTarget)}
        intensity={25}
        tint={isDark ? "dark" : "default"}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Pressable
        accessible={onPress !== undefined}
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: isDark ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.12)",
          },
        ]}
        onPress={onPress ?? blockPress}
      />
    </>
  );
}
