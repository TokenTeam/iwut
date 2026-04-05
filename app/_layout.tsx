import { ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { Appearance } from "react-native";
import "react-native-reanimated";
import Toast from "react-native-toast-message";

import { Themes } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeStore } from "@/store/theme";

import "../global.css";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const themeMode = useThemeStore((s) => s.themeMode);
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      if (themeMode === "system") return;
    }
    Appearance.setColorScheme(
      themeMode === "system" ? "unspecified" : themeMode,
    );
  }, [themeMode]);

  return (
    <ThemeProvider value={Themes[colorScheme === "dark" ? "dark" : "default"]}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
      <Toast />
    </ThemeProvider>
  );
}
