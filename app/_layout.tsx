import * as Sentry from "@sentry/react-native";

import { SENTRY_DSN } from "@/constants/api";

Sentry.init({
  dsn: SENTRY_DSN,
  enableAutoSessionTracking: false,
  tracesSampleRate: 0,
  enabled: !__DEV__,
});

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
import { useUpdateStore } from "@/store/update";

import "../global.css";

export const unstable_settings = {
  anchor: "(tabs)",
};

function RootLayout() {
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

  useEffect(() => {
    useUpdateStore.getState().check();
  }, []);

  return (
    <ThemeProvider value={Themes[colorScheme === "dark" ? "dark" : "default"]}>
      <Stack
        screenOptions={{
          headerBackButtonDisplayMode: "minimal",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
      <Toast />
    </ThemeProvider>
  );
}

export default Sentry.wrap(RootLayout);
