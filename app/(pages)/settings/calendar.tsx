import { Stack } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  Switch,
} from "react-native";
import Toast from "react-native-toast-message";

import { AlertDialog } from "@/components/ui/alert-dialog";
import { CalendarPickerSheet } from "@/components/ui/calendar-picker-sheet";
import { MenuGroup, MenuItem } from "@/components/ui/menu-item";
import { BUILTIN_PALETTE_NAME_KEYS } from "@/constants/course-palettes";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";
import { useT } from "@/lib/i18n";
import {
  APP_LOCAL_CALENDAR_ID,
  deleteAppCalendar,
  getWritableCalendars,
  requestCalendarPermission,
  syncCoursesToCalendar,
  type WritableCalendars,
} from "@/services/calendar-sync";
import { useCourseStore } from "@/store/course";
import { useScheduleStore } from "@/store/schedule";
import { useSettingsStore } from "@/store/settings";

export default function CalendarSettingsScreen() {
  useMarkRouteInteractive();
  const t = useT();

  const scrollWeekend = useScheduleStore((s) => s.scrollWeekend);
  const setScrollWeekend = useScheduleStore((s) => s.setScrollWeekend);
  const showMidday = useScheduleStore((s) => s.showMiddaySections);
  const setShowMidday = useScheduleStore((s) => s.setShowMiddaySections);
  const showOtherWeekCourses = useScheduleStore((s) => s.showOtherWeekCourses);
  const setShowOtherWeekCourses = useScheduleStore(
    (s) => s.setShowOtherWeekCourses,
  );
  const colorPalette = useScheduleStore((s) => s.colorPalette);

  const courses = useCourseStore((s) => s.courses);
  const calendarSync = useSettingsStore((s) => s.calendarSync);
  const setCalendarSync = useSettingsStore((s) => s.setCalendarSync);
  const syncedCalendarIds = useSettingsStore((s) => s.syncedCalendarIds);

  const [syncing, setSyncing] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  // Calendars fetched up-front so the picker can render without re-enumerating.
  const [pickerData, setPickerData] = useState<WritableCalendars | undefined>();
  const [confirmRemoveVisible, setConfirmRemoveVisible] = useState(false);
  // Set synchronously the moment the user flips the switch ON, so the toggle
  // stays visually ON across the async permission / calendar-loading gap
  // instead of snapping back to OFF and flickering.
  const [pendingOn, setPendingOn] = useState(false);
  // Mirror of pendingOn for turn-off: flip the switch OFF immediately while the
  // remove confirmation is shown, then smoothly back ON if the user cancels.
  const [pendingOff, setPendingOff] = useState(false);

  // Switch shows ON while synced / picker open / a turn-on is in progress,
  // unless a turn-off confirmation is pending (then it reads OFF).
  const displaySwitchOn =
    (calendarSync || pickerVisible || pendingOn) && !pendingOff;

  const courseCount = useMemo(() => {
    const names = new Set(courses.map((c) => c.name));
    return names.size;
  }, [courses]);

  const performRemove = useCallback(async () => {
    setSyncing(true);
    await deleteAppCalendar();
    setSyncing(false);
    setCalendarSync(false);
    Toast.show({
      type: "success",
      text1: t("calendarSet.syncRemoved"),
      position: "bottom",
    });
  }, [setCalendarSync, t]);

  const doSync = useCallback(
    async (calendarIds: string[] | undefined) => {
      setPickerVisible(false);
      setSyncing(true);
      const result = await syncCoursesToCalendar(calendarIds);
      setSyncing(false);

      if (result.success) {
        setCalendarSync(true);
        Toast.show({
          type: result.failed > 0 ? "info" : "success",
          text1: t("calendarSet.syncedToast"),
          text2:
            result.failed > 0
              ? t("calendarSet.syncedPartialSub", {
                  n: result.count,
                  m: result.failed,
                })
              : t("calendarSet.syncedSub", { n: result.count }),
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
    },
    [setCalendarSync, t],
  );

  const handleCalendarSyncToggle = async (value: boolean) => {
    if (!value) {
      // Android may surface a system dialog when removing many events from a
      // cloud/third-party calendar ("deletion count exceeds the limit"). Only
      // warn in that case — a local-only sync deletes cleanly with no prompt.
      const syncedToNonLocal = syncedCalendarIds.some(
        (id) => id !== APP_LOCAL_CALENDAR_ID,
      );
      if (Platform.OS === "android" && syncedToNonLocal) {
        // Flip the switch OFF first, then ask for confirmation.
        setPendingOff(true);
        setConfirmRemoveVisible(true);
        return;
      }
      await performRemove();
      return;
    }

    // Optimistically keep the switch ON during the async work below.
    setPendingOn(true);

    const hasPerm = await requestCalendarPermission();
    if (!hasPerm) {
      setPendingOn(false);
      Toast.show({
        type: "error",
        text1: t("calendarSet.syncFailed"),
        text2: t("calSync.errNoPermission"),
        position: "bottom",
      });
      return;
    }

    const writable = await getWritableCalendars();

    if (writable.others.length === 0) {
      // No selectable external calendars — write to the app-local one directly.
      await doSync(undefined);
      setPendingOn(false);
      return;
    }

    // Hand the already-fetched calendars to the picker so it renders instantly,
    // and keep the switch visually ON while it's open.
    setPickerData(writable);
    setPickerVisible(true);
    setPendingOn(false);
  };

  const handlePickerClose = useCallback(() => {
    setPickerVisible(false);
    // If sync was not committed, the switch should smoothly go back to OFF
    // (calendarSync is still false at this point)
  }, []);

  const paletteKey = BUILTIN_PALETTE_NAME_KEYS[colorPalette.name];
  const paletteDisplayName = paletteKey ? t(paletteKey) : colorPalette.name;

  return (
    <>
      <Stack.Screen options={{ title: t("calendarSet.title") }} />
      <ScrollView
        className="flex-1 bg-neutral-100 dark:bg-neutral-900"
        contentContainerClassName="px-4 pt-4 pb-8"
      >
        <MenuGroup title={t("calendarSet.courseGroup")}>
          <MenuItem
            icon="school"
            iconBg="#34C759"
            label={t("calendarSet.courseManage")}
            value={
              courseCount > 0
                ? t("calendarSet.courseCount", { n: courseCount })
                : t("calendarSet.noCourses")
            }
            href="/settings/course/manage"
          />
        </MenuGroup>

        <MenuGroup title={t("calendarSet.displayGroup")}>
          <MenuItem
            icon="swap-horiz"
            iconBg="#007AFF"
            label={t("calendarSet.scrollWeekend")}
            showArrow={false}
            right={
              <Switch value={scrollWeekend} onValueChange={setScrollWeekend} />
            }
          />
          <MenuItem
            icon="wb-sunny"
            iconBg="#FF9500"
            label={t("calendarSet.showMidday")}
            showArrow={false}
            right={<Switch value={showMidday} onValueChange={setShowMidday} />}
          />
          <MenuItem
            icon="visibility"
            iconBg="#8E8E93"
            label={t("calendarSet.showOtherWeek")}
            showArrow={false}
            right={
              <Switch
                value={showOtherWeekCourses}
                onValueChange={setShowOtherWeekCourses}
              />
            }
          />
        </MenuGroup>

        <MenuGroup title={t("calendarSet.syncGroup")}>
          <MenuItem
            icon="event"
            iconBg="#FF9500"
            label={t("calendarSet.syncCalendar")}
            showArrow={false}
            right={
              syncing ? (
                <ActivityIndicator size="small" />
              ) : (
                <Switch
                  value={displaySwitchOn}
                  onValueChange={handleCalendarSyncToggle}
                />
              )
            }
          />
        </MenuGroup>

        <MenuGroup title={t("calendarSet.customGroup")}>
          <MenuItem
            icon="palette"
            iconBg="#5856D6"
            label={t("calendarSet.palette")}
            value={paletteDisplayName}
            href="/settings/course/palette"
          />
          <MenuItem
            icon="tune"
            iconBg="#0EA5E9"
            label={t("calendarSet.visualStyle")}
            href="/settings/schedule-visual"
          />
        </MenuGroup>
      </ScrollView>

      <CalendarPickerSheet
        visible={pickerVisible}
        onClose={handlePickerClose}
        onConfirm={doSync}
        initialData={pickerData}
      />

      <AlertDialog
        visible={confirmRemoveVisible}
        onClose={() => {
          // Cancelled: bring the switch smoothly back ON.
          setConfirmRemoveVisible(false);
          setPendingOff(false);
        }}
        title={t("calendarSet.removeConfirmTitle")}
        description={t("calendarSet.removeConfirmDesc")}
        confirmText={t("calendarSet.removeConfirmOk")}
        destructive
        onConfirm={() => {
          setConfirmRemoveVisible(false);
          setPendingOff(false);
          void performRemove();
        }}
      />
    </>
  );
}
