import { File, Paths } from "expo-file-system";
import { Stack } from "expo-router";
import * as Sharing from "expo-sharing";
import { useMemo, useRef, useState } from "react";
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
import { MAX_SECTION, MAX_WEEK } from "@/lib/course-weeks";
import { useT } from "@/lib/i18n";
import { reportError } from "@/lib/report";
import {
  APP_LOCAL_CALENDAR_ID,
  deleteAppCalendar,
  getWritableCalendars,
  requestCalendarPermission,
  syncCoursesToCalendar,
  type CalendarInfo,
} from "@/services/calendar-sync";
import { useCourseStore, type Course } from "@/store/course";
import { useScheduleStore } from "@/store/schedule";
import { useSettingsStore } from "@/store/settings";

interface CourseData {
  courses: Course[];
  termStart: string;
}

function isInt(value: unknown, min: number, max: number): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  );
}

function isTime(value: unknown): boolean {
  return (
    value === undefined ||
    (typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value))
  );
}

function isCourse(value: unknown): value is Course {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.name === "string" &&
    c.name.trim().length > 0 &&
    typeof c.room === "string" &&
    typeof c.teacher === "string" &&
    isInt(c.day, 1, 7) &&
    isInt(c.weekStart, 1, MAX_WEEK) &&
    isInt(c.weekEnd, c.weekStart, MAX_WEEK) &&
    isInt(c.sectionStart, 1, MAX_SECTION) &&
    isInt(c.sectionEnd, c.sectionStart, MAX_SECTION) &&
    (c.note === undefined || typeof c.note === "string") &&
    (c.seat === undefined ||
      (typeof c.seat === "number" && Number.isFinite(c.seat))) &&
    isTime(c.startTime) &&
    isTime(c.endTime) &&
    (c.source === undefined ||
      c.source === "imported" ||
      c.source === "manual" ||
      c.source === "lab")
  );
}

function isTermStart(value: unknown): value is string {
  if (value === "") return true;
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function parseCourseData(text: string): CourseData | null {
  let value: unknown;
  try {
    value = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const data = value as Record<string, unknown>;
  if (
    !Array.isArray(data.courses) ||
    !data.courses.every(isCourse) ||
    !isTermStart(data.termStart)
  ) {
    return null;
  }
  return { courses: data.courses, termStart: data.termStart };
}

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
  const [courseDataAction, setCourseDataAction] = useState<
    "export" | "import" | null
  >(null);
  const courseDataBusy = useRef(false);
  const [pendingCourseData, setPendingCourseData] = useState<CourseData | null>(
    null,
  );
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

  const handleExportCourses = async () => {
    if (courseDataBusy.current || pendingCourseData) return;
    courseDataBusy.current = true;
    setCourseDataAction("export");
    try {
      const { courses, termStart } = useCourseStore.getState();
      const file = new File(Paths.cache, `iwut_courses_${Date.now()}.json`);
      await file.write(JSON.stringify({ courses, termStart }, null, 2));
      await Sharing.shareAsync(file.uri, {
        UTI: "public.json",
        mimeType: "application/json",
        dialogTitle: t("calendarSet.exportCourses"),
      });
    } catch (error) {
      reportError(error, { module: "settings", action: "export-courses" });
      Toast.show({
        type: "error",
        text1: t("calendarSet.exportCoursesFailed"),
        position: "bottom",
      });
    } finally {
      courseDataBusy.current = false;
      setCourseDataAction(null);
    }
  };

  const handleImportCourses = async () => {
    if (courseDataBusy.current || pendingCourseData) return;
    courseDataBusy.current = true;
    setCourseDataAction("import");
    try {
      const picked = await File.pickFileAsync({
        mimeTypes: ["application/json", "text/plain"],
      });
      if (picked.canceled) return;
      const data = parseCourseData(await picked.result.text());
      if (!data) {
        Toast.show({
          type: "error",
          text1: t("calendarSet.invalidCourseData"),
          position: "bottom",
        });
        return;
      }
      setPendingCourseData(data);
    } catch (error) {
      reportError(error, { module: "settings", action: "import-courses" });
      Toast.show({
        type: "error",
        text1: t("calendarSet.importCoursesFailed"),
        position: "bottom",
      });
    } finally {
      courseDataBusy.current = false;
      setCourseDataAction(null);
    }
  };

  const confirmImportCourses = () => {
    if (!pendingCourseData) return;
    useCourseStore.setState({
      courses: pendingCourseData.courses,
      termStart: pendingCourseData.termStart,
    });
    setPendingCourseData(null);
    Toast.show({
      type: "success",
      text1: t("calendarSet.coursesImported"),
      position: "bottom",
    });
  };

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
          <MenuItem
            icon="file-upload"
            iconBg="#FF9500"
            label={t("calendarSet.exportCourses")}
            showArrow={false}
            right={
              courseDataAction === "export" ? (
                <ActivityIndicator size="small" />
              ) : undefined
            }
            onPress={handleExportCourses}
          />
          <MenuItem
            icon="file-download"
            iconBg="#0797B9"
            label={t("calendarSet.importCourses")}
            showArrow={false}
            right={
              courseDataAction === "import" ? (
                <ActivityIndicator size="small" />
              ) : undefined
            }
            onPress={handleImportCourses}
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

      <ConfirmSheet
        visible={pendingCourseData !== null}
        onClose={() => setPendingCourseData(null)}
        title={t("calendarSet.importCourses")}
        description={t("calendarSet.importCoursesDesc", {
          n: pendingCourseData?.courses.length ?? 0,
        })}
        confirmText={t("calendarSet.importCoursesConfirm")}
        onConfirm={confirmImportCourses}
      />

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
