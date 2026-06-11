import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  Pressable,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { MenuGroup, MenuItem } from "@/components/ui/menu-item";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useHaptics } from "@/hooks/use-haptics";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";
import { useT } from "@/lib/i18n";
import {
  deleteAppCalendar,
  syncCoursesToCalendar,
} from "@/services/calendar-sync";
import {
  registerBackgroundRefresh,
  scheduleWeeklyReminders,
} from "@/services/course-notification";
import { type ImportType, useCourseStore } from "@/store/course";
import { useOnboardingStore } from "@/store/onboarding";
import { useSettingsStore } from "@/store/settings";
import { useUserBindStore } from "@/store/user-bind";

type StepId = "account" | "setup";

const appIcon = require("@/assets/images/icon.png");

function getInitialStep(isBound: boolean, hasCourses: boolean): StepId {
  if (isBound || hasCourses) return "setup";
  return "account";
}

export default function OnboardingScreen() {
  useMarkRouteInteractive();
  const t = useT();
  const haptic = useHaptics();
  const isDark = useColorScheme() === "dark";
  const isBound = useUserBindStore((s) => s.isBound);
  const courseCount = useCourseStore((s) => s.courses.length);
  const completeOnboarding = useOnboardingStore((s) => s.complete);
  const courseReminder = useSettingsStore((s) => s.courseReminder);
  const setCourseReminder = useSettingsStore((s) => s.setCourseReminder);
  const calendarSync = useSettingsStore((s) => s.calendarSync);
  const setCalendarSync = useSettingsStore((s) => s.setCalendarSync);

  const hasCourses = courseCount > 0;
  const [selectedStep] = useState<StepId>(() =>
    getInitialStep(isBound, hasCourses),
  );
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [calendarBusy, setCalendarBusy] = useState(false);

  const step = selectedStep === "account" && !isBound ? "account" : "setup";

  const handleLogin = () => {
    if (!acceptedLegal) {
      Toast.show({
        type: "info",
        text1: t("onboarding.legalRequired"),
        position: "bottom",
      });
      return;
    }
    haptic();
    router.push("/browser/bind");
  };

  const handleImport = (type: ImportType) => {
    haptic();
    router.push({
      pathname: "/browser/course",
      params: { type },
    });
  };

  const handleReminderToggle = async (value: boolean) => {
    setNotificationBusy(true);
    try {
      if (value && Platform.OS === "android") {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) return;
      }

      setCourseReminder(value);
      await scheduleWeeklyReminders();
      if (value) await registerBackgroundRefresh();
    } finally {
      setNotificationBusy(false);
    }
  };

  const handleCalendarToggle = async (value: boolean) => {
    if (!value) {
      await deleteAppCalendar();
      setCalendarSync(false);
      return;
    }
    if (!hasCourses) {
      Toast.show({
        type: "info",
        text1: t("onboarding.calendarNeedsCourses"),
        position: "bottom",
      });
      return;
    }

    setCalendarBusy(true);
    const result = await syncCoursesToCalendar();
    setCalendarBusy(false);
    if (result.success) {
      setCalendarSync(true);
      Toast.show({
        type: "success",
        text1: t("calendarSet.syncedToast"),
        text2: t("calendarSet.syncedSub", { n: result.count }),
        position: "bottom",
      });
    } else {
      Toast.show({
        type: "error",
        text1: t("calendarSet.syncFailed"),
        text2: result.error,
        position: "bottom",
      });
    }
  };

  const finish = () => {
    haptic();
    completeOnboarding();
    router.replace("/");
  };

  if (step === "account") {
    return (
      <AccountWelcome
        acceptedLegal={acceptedLegal}
        isDark={isDark}
        onAcceptChange={setAcceptedLegal}
        onLogin={handleLogin}
        onOpenPrivacy={() => router.push("/legal/privacy-policy")}
        onOpenUserAgreement={() => router.push("/legal/user-agreement")}
      />
    );
  }

  return (
    <SetupScreen
      calendarBusy={calendarBusy}
      calendarSync={calendarSync}
      courseCount={courseCount}
      courseReminder={courseReminder}
      hasCourses={hasCourses}
      isDark={isDark}
      notificationBusy={notificationBusy}
      onCalendarToggle={handleCalendarToggle}
      onFinish={finish}
      onImport={handleImport}
      onReminderToggle={handleReminderToggle}
    />
  );
}

function AccountWelcome({
  acceptedLegal,
  isDark,
  onAcceptChange,
  onLogin,
  onOpenPrivacy,
  onOpenUserAgreement,
}: Readonly<{
  acceptedLegal: boolean;
  isDark: boolean;
  onAcceptChange: (value: boolean) => void;
  onLogin: () => void;
  onOpenPrivacy: () => void;
  onOpenUserAgreement: () => void;
}>) {
  const t = useT();
  const muted = isDark ? "#A3A3A3" : "#737373";
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const availableHeight = height - insets.top - insets.bottom;
  const loginButtonTop = insets.top + availableHeight * 0.618 - 27;
  const logoTop = insets.top + availableHeight * 0.23;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: isDark ? "#171717" : "#F5F5F5",
      }}
    >
      <View
        style={{
          position: "absolute",
          left: 24,
          right: 24,
          top: logoTop,
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: 104,
            height: 104,
            borderRadius: 24,
            boxShadow: isDark
              ? "0 10px 26px rgba(0, 0, 0, 0.28)"
              : "0 10px 26px rgba(0, 0, 0, 0.08)",
          }}
        >
          <Image
            source={appIcon}
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 24,
            }}
            contentFit="cover"
          />
        </View>
        <Text
          style={{
            marginTop: 22,
            color: isDark ? "#FAFAFA" : "#171717",
            fontSize: 28,
            fontWeight: "700",
            letterSpacing: 0,
          }}
        >
          {t("onboarding.appName")}
        </Text>
      </View>

      <View
        style={{
          position: "absolute",
          left: 24,
          right: 24,
          top: loginButtonTop,
          gap: 14,
        }}
      >
        <PrimaryButton
          color="#007AFF"
          disabled={!acceptedLegal}
          label={t("onboarding.login")}
          onPress={onLogin}
        />
        <Pressable
          onPress={() => onAcceptChange(!acceptedLegal)}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            paddingHorizontal: 6,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <View
            style={{
              height: 16,
              width: 16,
              borderRadius: 8,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: acceptedLegal ? "#007AFF" : "transparent",
              borderWidth: 1.25,
              borderColor: acceptedLegal ? "#007AFF" : muted,
            }}
          >
            {acceptedLegal && (
              <Ionicons name="checkmark" size={11} color="#fff" />
            )}
          </View>
          <Text
            style={{
              flexShrink: 1,
              color: muted,
              fontSize: 12.5,
              lineHeight: 17,
              textAlign: "center",
            }}
          >
            {t("onboarding.legalAcceptPrefix")}
            <Text style={{ color: "#007AFF" }} onPress={onOpenUserAgreement}>
              {t("about.userAgreement")}
            </Text>
            {t("onboarding.legalAcceptAnd")}
            <Text style={{ color: "#007AFF" }} onPress={onOpenPrivacy}>
              {t("about.privacyPolicy")}
            </Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function SetupScreen({
  calendarBusy,
  calendarSync,
  courseCount,
  courseReminder,
  hasCourses,
  isDark,
  notificationBusy,
  onCalendarToggle,
  onFinish,
  onImport,
  onReminderToggle,
}: Readonly<{
  calendarBusy: boolean;
  calendarSync: boolean;
  courseCount: number;
  courseReminder: boolean;
  hasCourses: boolean;
  isDark: boolean;
  notificationBusy: boolean;
  onCalendarToggle: (value: boolean) => void;
  onFinish: () => void;
  onImport: (type: ImportType) => void;
  onReminderToggle: (value: boolean) => void;
}>) {
  const t = useT();
  const haptic = useHaptics();
  const insets = useSafeAreaInsets();
  const [showChoices, setShowChoices] = useState(false);
  const [importSkipped, setImportSkipped] = useState(false);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: isDark ? "#171717" : "#F5F5F5",
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 20,
        paddingTop: insets.top + 32,
      }}
    >
      <View style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 8 }}>
          <Text
            style={{
              color: isDark ? "#FAFAFA" : "#171717",
              fontSize: 32,
              fontWeight: "700",
              letterSpacing: 0,
            }}
          >
            {t("onboarding.setupTitle")}
          </Text>
          <Text
            style={{
              marginTop: 6,
              color: isDark ? "#A3A3A3" : "#737373",
              fontSize: 15,
              lineHeight: 21,
            }}
          >
            {t("onboarding.setupSubtitle")}
          </Text>
        </View>

        <View style={{ marginTop: 24 }}>
          <MenuGroup title={t("onboarding.scheduleSection")}>
            {hasCourses ? (
              <MenuItem
                icon="check-circle"
                iconBg="#34C759"
                label={t("onboarding.importDoneTitle")}
                value={t("onboarding.courseEntries", { n: courseCount })}
                showArrow={false}
              />
            ) : showChoices ? (
              <>
                <MenuItem
                  icon="school"
                  iconBg="#34C759"
                  label={t("course.bachelor")}
                  onPress={() => onImport("bachelor")}
                />
                <MenuItem
                  icon="menu-book"
                  iconBg="#AF52DE"
                  label={t("course.master")}
                  onPress={() => onImport("master")}
                />
                <MenuItem
                  icon="close"
                  iconBg="#8E8E93"
                  label={t("common.cancel")}
                  showArrow={false}
                  onPress={() => {
                    haptic();
                    setShowChoices(false);
                  }}
                />
              </>
            ) : (
              <>
                <MenuItem
                  icon="calendar-today"
                  iconBg="#34C759"
                  label={t("onboarding.importNow")}
                  onPress={() => {
                    haptic();
                    setShowChoices(true);
                  }}
                />
                <MenuItem
                  icon={importSkipped ? "check" : "schedule"}
                  iconBg={importSkipped ? "#34C759" : "#8E8E93"}
                  label={t("onboarding.importLater")}
                  value={importSkipped ? t("onboarding.selected") : undefined}
                  showArrow={false}
                  onPress={() => {
                    haptic();
                    setImportSkipped(true);
                  }}
                />
              </>
            )}
          </MenuGroup>

          <MenuGroup title={t("onboarding.optionsSection")}>
            <MenuItem
              icon="notifications-active"
              iconBg="#FF9500"
              label={t("settings.courseReminder")}
              showArrow={false}
              right={
                notificationBusy ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Switch
                    value={courseReminder}
                    onValueChange={onReminderToggle}
                  />
                )
              }
            />
            <MenuItem
              icon="event"
              iconBg="#007AFF"
              label={t("calendarSet.syncCalendar")}
              value={
                hasCourses ? undefined : t("onboarding.needTimetableShort")
              }
              showArrow={false}
              right={
                calendarBusy ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Switch
                    disabled={!hasCourses}
                    value={calendarSync}
                    onValueChange={onCalendarToggle}
                  />
                )
              }
            />
          </MenuGroup>
        </View>
      </View>

      <View style={{ marginTop: 28 }}>
        <PrimaryButton
          color="#007AFF"
          label={t("onboarding.startUsing")}
          onPress={onFinish}
        />
      </View>
    </View>
  );
}

function PrimaryButton({
  color,
  disabled,
  label,
  onPress,
}: Readonly<{
  color: string;
  disabled?: boolean;
  label: string;
  onPress: () => void;
}>) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        height: 54,
        borderRadius: 18,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: color,
        opacity: disabled ? 0.42 : pressed ? 0.82 : 1,
      })}
    >
      <Text style={{ color: "#fff", fontSize: 17, fontWeight: "700" }}>
        {label}
      </Text>
    </Pressable>
  );
}
