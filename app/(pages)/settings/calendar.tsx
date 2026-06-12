import { Stack } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Switch } from "react-native";
import Toast from "react-native-toast-message";

import { MenuGroup, MenuItem } from "@/components/ui/menu-item";
import { BUILTIN_PALETTE_NAME_KEYS } from "@/constants/course-palettes";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";
import { useT } from "@/lib/i18n";
import {
  deleteAppCalendar,
  syncCoursesToCalendar,
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

  const [syncing, setSyncing] = useState(false);

  const courseCount = useMemo(() => {
    const names = new Set(courses.map((c) => c.name));
    return names.size;
  }, [courses]);

  const handleCalendarSyncToggle = async (value: boolean) => {
    if (value) {
      setSyncing(true);
      const result = await syncCoursesToCalendar();
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
    } else {
      await deleteAppCalendar();
      setCalendarSync(false);
      Toast.show({
        type: "success",
        text1: t("calendarSet.syncRemoved"),
        position: "bottom",
      });
    }
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
                  value={calendarSync}
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
    </>
  );
}
