import { Stack } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { IconSymbol } from "@/components/ui/icon-symbol";
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
  type CalendarInfo,
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
  const termStart = useCourseStore((s) => s.termStart);
  const calendarSync = useSettingsStore((s) => s.calendarSync);
  const setCalendarSync = useSettingsStore((s) => s.setCalendarSync);
  const syncedCalendarIds = useSettingsStore((s) => s.syncedCalendarIds);

  const [syncing, setSyncing] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [writableCalendars, setWritableCalendars] = useState<CalendarInfo[]>(
    [],
  );
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<Set<string>>(
    () => new Set([APP_LOCAL_CALENDAR_ID]),
  );
  const [confirmRemoveVisible, setConfirmRemoveVisible] = useState(false);
  const [pendingOn, setPendingOn] = useState(false);
  const displaySwitchOn = calendarSync || pickerVisible || pendingOn;
  const localCalendarSelected = selectedCalendarIds.has(APP_LOCAL_CALENDAR_ID);
  const externalCalendarSelected = [...selectedCalendarIds].some(
    (id) => id !== APP_LOCAL_CALENDAR_ID,
  );

  const courseCount = useMemo(() => {
    const names = new Set(courses.map((c) => c.name));
    return names.size;
  }, [courses]);

  const showSyncError = (message?: string) => {
    Toast.show({
      type: "error",
      text1: t("calendarSet.syncFailed"),
      text2: message,
      position: "bottom",
    });
  };

  const performRemove = async () => {
    setSyncing(true);
    try {
      const result = await deleteAppCalendar();
      if (result.success) {
        setCalendarSync(false);
        Toast.show({
          type: "success",
          text1: t("calendarSet.syncRemoved"),
          position: "bottom",
        });
      } else {
        showSyncError(result.error);
      }
    } finally {
      setSyncing(false);
    }
  };

  const doSync = async (calendarIds?: string[]) => {
    setPickerVisible(false);
    setSyncing(true);
    try {
      const result = await syncCoursesToCalendar(calendarIds);
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
        showSyncError(result.error);
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleCalendarSyncToggle = async (value: boolean) => {
    if (!value) {
      const syncedToNonLocal = syncedCalendarIds.some(
        (id) => id !== APP_LOCAL_CALENDAR_ID,
      );
      if (Platform.OS === "android" && syncedToNonLocal) {
        setConfirmRemoveVisible(true);
        return;
      }
      await performRemove();
      return;
    }

    if (!termStart || courses.length === 0) {
      showSyncError(t("calSync.errNoData"));
      return;
    }

    setPendingOn(true);

    try {
      const hasPerm = await requestCalendarPermission();
      if (!hasPerm) {
        showSyncError(t("calSync.errNoPermission"));
        return;
      }

      const calendars = await getWritableCalendars();

      if (calendars.length === 0) {
        await doSync(undefined);
        return;
      }

      setWritableCalendars(calendars);
      setSelectedCalendarIds(new Set([APP_LOCAL_CALENDAR_ID]));
      setPickerVisible(true);
    } catch (error) {
      showSyncError(
        error instanceof Error ? error.message : t("calSync.errUnknown"),
      );
    } finally {
      setPendingOn(false);
    }
  };

  const toggleCalendar = (id: string) => {
    setSelectedCalendarIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
                  disabled={pendingOn}
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

      <BottomSheet
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        title={t("calendarSet.pickerTitle")}
      >
        <Text className="px-5 pb-3 text-sm text-neutral-500 dark:text-neutral-400">
          {t("calendarSet.pickerHint")}
        </Text>
        <ScrollView style={{ maxHeight: 320 }}>
          <Text className="px-5 pb-1 text-xs uppercase text-neutral-400 dark:text-neutral-500">
            {t("calendarSet.pickerLocalGroup")}
          </Text>
          <MenuItem
            icon="event"
            iconBg="#007AFF"
            label={t("calendarSet.pickerLocal")}
            value="iwut"
            showArrow={false}
            onPress={() => toggleCalendar(APP_LOCAL_CALENDAR_ID)}
            right={
              <IconSymbol
                name={
                  localCalendarSelected
                    ? "check-circle"
                    : "radio-button-unchecked"
                }
                size={22}
                color={localCalendarSelected ? "#007AFF" : "#A3A3A3"}
              />
            }
          />

          {writableCalendars.length > 0 && (
            <>
              <Text className="px-5 pb-1 pt-3 text-xs uppercase text-neutral-400 dark:text-neutral-500">
                {t("calendarSet.pickerOther")}
              </Text>
              {writableCalendars.map((calendar) => {
                const selected = selectedCalendarIds.has(calendar.id);
                return (
                  <MenuItem
                    key={calendar.id}
                    icon="event"
                    iconBg={calendar.color || "#9CA3AF"}
                    label={calendar.title}
                    value={calendar.accountName}
                    showArrow={false}
                    onPress={() => toggleCalendar(calendar.id)}
                    right={
                      <IconSymbol
                        name={
                          selected ? "check-circle" : "radio-button-unchecked"
                        }
                        size={22}
                        color={selected ? "#007AFF" : "#A3A3A3"}
                      />
                    }
                  />
                );
              })}
            </>
          )}
        </ScrollView>

        {externalCalendarSelected && (
          <Text className="mx-5 mt-2 rounded-xl bg-orange-50 px-3 py-2 text-xs leading-5 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300">
            {t("calendarSet.pickerOtherWarning")}
          </Text>
        )}

        <View className="px-5 pt-3">
          <Pressable
            className={`items-center rounded-xl py-3 ${
              selectedCalendarIds.size > 0
                ? "bg-blue-500 active:bg-blue-600"
                : "bg-neutral-300 dark:bg-neutral-700"
            }`}
            disabled={selectedCalendarIds.size === 0}
            onPress={() => void doSync([...selectedCalendarIds])}
          >
            <Text className="text-base font-medium text-white">
              {t("calendarSet.pickerSync")}
            </Text>
          </Pressable>
        </View>
      </BottomSheet>

      <ConfirmSheet
        visible={confirmRemoveVisible}
        onClose={() => setConfirmRemoveVisible(false)}
        title={t("calendarSet.removeConfirmTitle")}
        description={t("calendarSet.removeConfirmDesc")}
        confirmText={t("calendarSet.removeConfirmOk")}
        destructive
        onConfirm={() => {
          setConfirmRemoveVisible(false);
          void performRemove();
        }}
      />
    </>
  );
}
