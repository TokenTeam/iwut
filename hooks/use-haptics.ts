import * as Haptics from "expo-haptics";
import { useCallback } from "react";
import { Platform } from "react-native";

import { useSettingsStore } from "@/store/settings";

export function useHaptics() {
  const enabled = useSettingsStore((s) => s.hapticFeedback);

  return useCallback(() => {
    if (!enabled) return;

    if (Platform.OS === "ios") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return;
    }

    if (Platform.OS === "android") {
      void Haptics.performAndroidHapticsAsync(
        Haptics.AndroidHaptics.Context_Click,
      );
      return;
    }

    void Haptics.selectionAsync();
  }, [enabled]);
}
