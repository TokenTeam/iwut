import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";
import { FileLogger } from "react-native-file-logger";

import { SENTRY_DSN } from "@/constants/api";

// 日志记录需要提前初始化，便于捕获后续 import 中可能出现的错误
Sentry.init({
  dsn: SENTRY_DSN,
  enableAutoSessionTracking: false,
  tracesSampleRate: 0,
  enabled: !__DEV__,
  dist:
    (Constants.expoConfig?.extra?.commit as string | undefined) ?? "unknown",
});

FileLogger.configure({
  dailyRolling: true,
  maximumFileSize: 1024 * 512,
  captureConsole: true,
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
import { AppState, Appearance, Platform, View } from "react-native";
import "react-native-reanimated";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { Themes } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { syncCoursesToCalendar } from "@/services/calendar-sync";
import {
  initNotificationChannel,
  registerBackgroundRefresh,
  scheduleWeeklyReminders,
  showUpcomingLiveActivity,
} from "@/services/course-notification";
import { syncWidgetData } from "@/services/widget-sync";
import { useAnnouncementStore } from "@/store/announcements";
import { useCourseStore } from "@/store/course";
import { useSettingsStore } from "@/store/settings";
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
    useAnnouncementStore.getState().fetch();
  }, []);

  useEffect(() => {
    initNotificationChannel().catch(() => {});
    scheduleWeeklyReminders().catch(() => {});
    registerBackgroundRefresh().catch(() => {});
    showUpcomingLiveActivity().catch(() => {});
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      if (Platform.OS === "ios") {
        showUpcomingLiveActivity().catch(() => {});
      }
      useAnnouncementStore.getState().fetch();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    syncWidgetData().catch(() => {});
    const unsub = useCourseStore.subscribe((state, prev) => {
      if (
        state.courses !== prev.courses ||
        state.termStart !== prev.termStart
      ) {
        syncWidgetData().catch(() => {});
        scheduleWeeklyReminders().catch(() => {});
        if (useSettingsStore.getState().calendarSync) {
          syncCoursesToCalendar().catch(() => {});
        }
      }
    });
    return unsub;
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
