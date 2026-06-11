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
  maximumNumberOfFiles: 5,
  captureConsole: true,
});

/* eslint-disable import/first */
import "@/lib/i18n/bootstrap";
import { Feather, Ionicons } from "@expo/vector-icons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useFonts } from "expo-font";
import { Observe, ObserveRoot } from "expo-observe";
import { Stack, router, useSegments } from "expo-router";
import { ThemeProvider } from "expo-router/react-navigation";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as Updates from "expo-updates";
import { useCallback, useEffect, useRef } from "react";
import { AppState, Appearance, Platform, View } from "react-native";
import "react-native-reanimated";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { AppBlurTargetProvider } from "@/components/ui/app-blur-target";
import { UpdateModal } from "@/components/ui/update-modal";
import { Themes } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { refreshSystemLocale } from "@/lib/i18n";
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
import { useOnboardingStore } from "@/store/onboarding";
import { useSettingsStore } from "@/store/settings";
import { useThemeStore } from "@/store/theme";
import { useUpdateStore } from "@/store/update";
import { useUserBindStore } from "@/store/user-bind";

import "../global.css";
/* eslint-enable import/first */

export const unstable_settings = {
  anchor: "(tabs)",
};

Observe.configure({
  environment: Updates.channel ?? "development",
  dispatchingEnabled: !__DEV__,
  integrations: { "expo-router": true },
});

void SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore if the splash screen was already hidden by the platform/runtime.
});

function RootLayout() {
  const colorScheme = useColorScheme();
  const themeMode = useThemeStore((s) => s.themeMode);
  const segments = useSegments();
  const onboardingCompleted = useOnboardingStore((s) => s.completed);
  const completeOnboarding = useOnboardingStore((s) => s.complete);
  const isBound = useUserBindStore((s) => s.isBound);
  const courseCount = useCourseStore((s) => s.courses.length);
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
    const firstSegment = segments[0] as string | undefined;
    const inOnboarding = firstSegment === "onboarding";
    const isSetupSideRoute =
      firstSegment === "browser" || firstSegment === "(pages)";

    if (
      !onboardingCompleted &&
      (isBound || courseCount > 0) &&
      !inOnboarding &&
      !isSetupSideRoute
    ) {
      completeOnboarding();
      return;
    }

    if (!onboardingCompleted && !inOnboarding && !isSetupSideRoute) {
      router.replace("/onboarding" as never);
      return;
    }
  }, [completeOnboarding, courseCount, isBound, onboardingCompleted, segments]);

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
      // On Android the app keeps running across system-language changes, so
      // re-resolve the device locale whenever we come back to the foreground.
      if (Platform.OS === "android") {
        refreshSystemLocale();
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
          <AppBlurTargetProvider>
            <Stack
              screenOptions={{
                headerBackButtonDisplayMode: "minimal",
              }}
            >
              <Stack.Screen
                name="onboarding"
                options={{ headerShown: false }}
              />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
            <StatusBar style="auto" />
            <Toast />
            <UpdateModal />
          </AppBlurTargetProvider>
        </ThemeProvider>
      </View>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(ObserveRoot.wrap(RootLayout));
