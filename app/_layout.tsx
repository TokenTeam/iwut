import * as Sentry from "@sentry/react-native";

import { SENTRY_DSN } from "@/constants/api";

Sentry.init({
  dsn: SENTRY_DSN,
  enableAutoSessionTracking: false,
  tracesSampleRate: 0,
  enabled: !__DEV__,
});

/* eslint-disable import/first */
import { Feather, Ionicons } from "@expo/vector-icons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef } from "react";
import { Appearance, View } from "react-native";
import "react-native-reanimated";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { Themes } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeStore } from "@/store/theme";
import { useUpdateStore } from "@/store/update";

import "../global.css";
/* eslint-enable import/first */

export const unstable_settings = {
  anchor: "(tabs)",
};

void SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore if the splash screen was already hidden by the platform/runtime.
});

function RootLayout() {
  const colorScheme = useColorScheme();
  const themeMode = useThemeStore((s) => s.themeMode);
  const isFirstMount = useRef(true);
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
    ...MaterialIcons.font,
    ...Feather.font,
  });

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

  const onLayoutRootView = useCallback(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <ThemeProvider
          value={Themes[colorScheme === "dark" ? "dark" : "default"]}
        >
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
      </View>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(RootLayout);
