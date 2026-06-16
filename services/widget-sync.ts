import { getLang } from "@/lib/i18n";
import {
  reloadWidgets,
  setWidgetData,
  setWidgetString,
} from "@/modules/widget";
import { SECTION_TIMES } from "@/services/course-time";
import { useCourseStore } from "@/store/course";

interface WidgetCourse {
  name: string;
  room: string;
  day: number;
  weekStart: number;
  weekEnd: number;
  sectionStart: number;
  sectionEnd: number;
  startTime: string;
  endTime: string;
}

interface ScheduleWidgetData {
  courses: WidgetCourse[];
  termStart: string;
  updatedAt: string;
}

/**
 * Push the user's explicit language choice to the widget's shared storage so
 * its native code can render in the same language as the app. Safe to call
 * any time the language changes; widgets will pick it up on their next
 * refresh.
 *
 * For "system" we intentionally push an empty string rather than the current
 * resolved tag. This delegates the resolution to the widget's own native
 * code, which reads `LocaleManager.systemLocales` (Android 13+) or the
 * equivalent device-level API. Two benefits:
 *
 *   1. Switching back to "follow system" takes effect immediately on the
 *      widget without depending on the in-process locale state of the RN
 *      runtime, which may still be stale right after the switch.
 *   2. Subsequent changes to the *device* language while the app stays in
 *      "system" mode are picked up by the widget on its next refresh,
 *      without requiring the RN runtime to be alive to re-sync.
 */
export async function syncWidgetLang(): Promise<void> {
  const choice = getLang();
  const tag = choice === "zh" ? "zh-Hans" : choice === "en" ? "en" : "";
  await setWidgetString("lang", tag);
}

export async function syncWidgetData(): Promise<void> {
  const { courses, termStart } = useCourseStore.getState();
  if (!termStart || courses.length === 0) return;

  // Coerce every field to a non-null primitive. The native widget decodes
  // into non-optional Swift types; a stray null/undefined here would otherwise
  // fail decoding and blank the widget.
  const widgetCourses: WidgetCourse[] = courses.map((c) => ({
    name: c.name ?? "",
    room: c.room ?? "",
    day: c.day ?? 0,
    weekStart: c.weekStart ?? 0,
    weekEnd: c.weekEnd ?? 0,
    sectionStart: c.sectionStart ?? 0,
    sectionEnd: c.sectionEnd ?? 0,
    startTime: SECTION_TIMES[c.sectionStart]?.[0] ?? "",
    endTime: SECTION_TIMES[c.sectionEnd]?.[1] ?? "",
  }));

  const data: ScheduleWidgetData = {
    courses: widgetCourses,
    termStart,
    updatedAt: new Date().toISOString(),
  };

  await setWidgetData("schedule", data as unknown as Record<string, unknown>);
  await syncWidgetLang();
  await reloadWidgets();
}
