import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { Platform } from "react-native";
import {
  useSafeAreaFrame,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { useStartupStore } from "@/store/startup";

export function useTabViewport() {
  const { width, height } = useSafeAreaFrame();
  const { bottom } = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "ios") return;
      useStartupStore.getState().setViewport({
        width,
        height,
        bottomInset: bottom,
      });
    }, [width, height, bottom]),
  );
}
