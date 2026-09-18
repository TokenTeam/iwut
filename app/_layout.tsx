import Constants from "expo-constants";
import { FileLogger } from "react-native-file-logger";

import { SENTRY_DSN } from "@/constants/api";

if (!__DEV__) {
  void import("@sentry/react-native")
    .then((Sentry) => {
      Sentry.init({
        dsn: SENTRY_DSN,
        enableAutoSessionTracking: false,
        tracesSampleRate: 0,
        dist:
          (Constants.expoConfig?.extra?.commit as string | undefined) ??
          "unknown",
      });
    })
    .catch(() => {
      // Monitoring must never block the app from starting.
    });
}

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
import { Stack, ThemeProvider, router, useSegments } from "expo-router";
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

import { TabBackground } from "@/components/layout/tab-background";
import { AppBlurTargetProvider } from "@/components/ui/app-blur-target";
import { UpdateModal } from "@/components/ui/update-modal";
import { Colors, Themes } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { refreshSystemLocale } from "@/lib/i18n";
import {
  clearSyncedCalendarData,
  syncCoursesToCalendar,
} from "@/services/calendar-sync";
import {
  initNotificationChannel,
  registerBackgroundRefresh,
  scheduleWeeklyReminders,
  showUpcomingLiveActivity,
  unregisterBackgroundRefresh,
} from "@/services/course-notification";
import { syncWidgetData } from "@/services/widget-sync";
import { useAnnouncementStore } from "@/store/announcements";
import { useCourseStore } from "@/store/course";
import { useExamStore } from "@/store/exam";
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

    if (onboardingCompleted && inOnboarding) {
      router.replace("/");
    }
  }, [completeOnboarding, courseCount, isBound, onboardingCompleted, segments]);

  useEffect(() => {
    initNotificationChannel().catch(() => {});
    scheduleWeeklyReminders().catch(() => {});
    const { courseReminder, examReminder } = useSettingsStore.getState();
    if (courseReminder || examReminder) {
      registerBackgroundRefresh().catch(() => {});
    } else {
      unregisterBackgroundRefresh().catch(() => {});
    }
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
    // 课程批量变更会连续触发订阅，debounce 后只执行最后一次
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const unsub = useCourseStore.subscribe((state, prev) => {
      if (
        state.courses !== prev.courses ||
        state.termStart !== prev.termStart
      ) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          syncWidgetData().catch(() => {});
          scheduleWeeklyReminders().catch(() => {});
          if (useSettingsStore.getState().calendarSync) {
            const ids = useSettingsStore.getState().syncedCalendarIds;
            if (!state.termStart || state.courses.length === 0) {
              clearSyncedCalendarData().catch(() => {});
            } else {
              syncCoursesToCalendar(ids.length > 0 ? ids : undefined).catch(
                () => {},
              );
            }
          }
        }, 400);
      }
    });
    // 考试数据导入/清空后重排考试提醒（与课程提醒共用同一调度流程）
    const unsubExam = useExamStore.subscribe((state, prev) => {
      if (state.exams !== prev.exams) {
        scheduleWeeklyReminders().catch(() => {});
      }
    });
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsub();
      unsubExam();
    };
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
      <AppBlurTargetProvider>
        <View
          style={{
            flex: 1,
            backgroundColor:
              Colors[colorScheme === "dark" ? "dark" : "light"].background,
          }}
          onLayout={onLayoutRootView}
        >
          <ThemeProvider
            value={Themes[colorScheme === "dark" ? "dark" : "default"]}
          >
            <TabBackground />
            <Stack
              activityEnabled
              screenOptions={{
                headerBackButtonDisplayMode: "minimal",
              }}
            >
              <Stack.Screen
                name="onboarding"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="(tabs)"
                options={{
                  headerShown: false,
                  contentStyle: { backgroundColor: "transparent" },
                }}
              />
            </Stack>
            <StatusBar style="auto" />
            <Toast />
            <UpdateModal />
          </ThemeProvider>
        </View>
      </AppBlurTargetProvider>
    </SafeAreaProvider>
  );
}

export default ObserveRoot.wrap(RootLayout);
