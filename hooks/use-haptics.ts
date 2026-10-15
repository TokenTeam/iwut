import * as Haptics from "expo-haptics";
import { useCallback } from "react";
import { Platform } from "react-native";

import { reportError } from "@/lib/report";
import { useSettingsStore } from "@/store/settings";

let hasReportedHapticsError = false;

export function useHaptics() {
  const enabled = useSettingsStore((s) => s.hapticFeedback);

  return useCallback(() => {
    if (!enabled) return;

    void (async () => {
      if (Platform.OS === "ios") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        return;
      }

      if (Platform.OS === "android") {
        await Haptics.performAndroidHapticsAsync(
          Haptics.AndroidHaptics.Context_Click,
        );
        return;
      }

      await Haptics.selectionAsync();
    })().catch((error: unknown) => {
      // 多次触发只上报一次
      if (hasReportedHapticsError) return;
      hasReportedHapticsError = true;
      reportError(error, { module: "haptics", platform: Platform.OS });
    });
  }, [enabled]);
}
