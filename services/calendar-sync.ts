import * as Calendar from "expo-calendar";
import { Platform } from "react-native";

import { getTermWeekMonday } from "@/lib/date";
import { t } from "@/lib/i18n";
import { reportError } from "@/lib/report";
import { SECTION_TIMES } from "@/services/course-time";
import { type Course, useCourseStore } from "@/store/course";

// Calendar entries are re-created on every sync, so we use the current locale
// at sync time rather than caching a value at module load.
function getCalendarTitle(): string {
  return t("calSync.title");
}
const CALENDAR_COLOR = "#007AFF";

export async function requestCalendarPermission(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === "granted";
}

async function findAppCalendar(): Promise<string | null> {
  const calendars = await Calendar.getCalendarsAsync(
    Calendar.EntityTypes.EVENT,
  );
  // Match by either the current locale's title or the legacy zh title so we
  // can clean up stale calendars after a language switch.
  const candidates = new Set([t("calSync.title"), "掌上吾理-我的课表"]);
  const found = calendars.find((c) => candidates.has(c.title ?? ""));
  return found?.id ?? null;
}

async function createAppCalendar(): Promise<string> {
  const title = getCalendarTitle();
  if (Platform.OS === "ios") {
    const defaultCalendar = await Calendar.getDefaultCalendarAsync();
    const id = await Calendar.createCalendarAsync({
      title,
      color: CALENDAR_COLOR,
      entityType: Calendar.EntityTypes.EVENT,
      sourceId: defaultCalendar.source.id,
      source: defaultCalendar.source,
      name: title,
      ownerAccount: "personal",
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
    });
    return id;
  }

  // Android 需要找到一个可用的 local source
  const calendars = await Calendar.getCalendarsAsync(
    Calendar.EntityTypes.EVENT,
  );
  const localSource = calendars.find(
    (c) => c.source && c.source.isLocalAccount,
  )?.source;

  const id = await Calendar.createCalendarAsync({
    title,
    color: CALENDAR_COLOR,
    entityType: Calendar.EntityTypes.EVENT,
    sourceId: localSource?.id,
    source:
      localSource ??
      ({
        isLocalAccount: true,
        name: title,
        type: Calendar.SourceType?.LOCAL ?? ("LOCAL" as Calendar.SourceType),
      } as Calendar.Source),
    name: title,
    ownerAccount: "personal",
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });
  return id;
}

function formatLocation(room: string | undefined): string | undefined {
  if (!room) return undefined;
  if (
    room.startsWith("马区") ||
    room.startsWith("南湖") ||
    room.startsWith("余区")
  ) {
    return `武理-${room}`;
  }
  return room;
}

function buildEventDate(
  monday: Date,
  dayOfWeek: number,
  timeStr: string,
): Date {
  const date = new Date(monday);
  date.setDate(date.getDate() + (dayOfWeek - 1));
  const [h, m] = timeStr.split(":").map(Number);
  date.setHours(h, m, 0, 0);
  return date;
}

export async function syncCoursesToCalendar(): Promise<{
  success: boolean;
  count: number;
  error?: string;
}> {
  const hasPermission = await requestCalendarPermission();
  if (!hasPermission) {
    return { success: false, count: 0, error: t("calSync.errNoPermission") };
  }

  const { courses, termStart } = useCourseStore.getState();
  if (!termStart || courses.length === 0) {
    return { success: false, count: 0, error: t("calSync.errNoData") };
  }

  try {
    // 每次同步先删除旧日历再重建
    const existingId = await findAppCalendar();
    if (existingId) {
      await Calendar.deleteCalendarAsync(existingId);
    }

    const calendarId = await createAppCalendar();

    if (Platform.OS === "android") {
      await new Promise((r) => setTimeout(r, 200));
    }

    let count = 0;
    let reported = false;
    for (const course of courses) {
      const events = createEventsForCourse(course, termStart);
      for (const eventData of events) {
        try {
          await Calendar.createEventAsync(calendarId, eventData);
          count++;
        } catch (e) {
          if (!reported) {
            // 避免重复上报
            reported = true;
            reportError(e, {
              module: "calendar-sync",
              course: course.name,
              day: course.day,
              section: `${course.sectionStart}-${course.sectionEnd}`,
            });
          }
        }
      }
    }

    if (count === 0 && reported) {
      return { success: false, count: 0, error: t("calSync.errWriteFail") };
    }
    return { success: true, count };
  } catch (e) {
    reportError(e, { module: "calendar-sync" });
    const msg = e instanceof Error ? e.message : t("calSync.errUnknown");
    return { success: false, count: 0, error: msg };
  }
}

type EventInput = Omit<Partial<Calendar.Event>, "id" | "organizer">;

function createEventsForCourse(
  course: Course,
  termStart: string,
): EventInput[] {
  const events: EventInput[] = [];

  for (let week = course.weekStart; week <= course.weekEnd; week++) {
    const monday = getTermWeekMonday(termStart, week);
    if (!monday) continue;

    const startTime = SECTION_TIMES[course.sectionStart];
    const endTime = SECTION_TIMES[course.sectionEnd];
    if (!startTime || !endTime) continue;

    const startDate = buildEventDate(monday, course.day, startTime[0]);
    const endDate = buildEventDate(monday, course.day, endTime[1]);

    if (
      isNaN(startDate.getTime()) ||
      isNaN(endDate.getTime()) ||
      startDate >= endDate
    ) {
      continue;
    }

    events.push({
      title: course.name,
      location: formatLocation(course.room),
      // 传递毫秒时间戳而非 Date 对象，原生层直接作为 Long/Double 使用，
      // 避免 ISO 字符串经 SimpleDateFormat 解析在部分 OEM 设备上丢失 DTSTART
      startDate: startDate.getTime() as unknown as Date,
      endDate: endDate.getTime() as unknown as Date,
      alarms: [{ relativeOffset: -15 }],
      notes: course.teacher
        ? t("calSync.teacherNotes", { teacher: course.teacher })
        : undefined,
      timeZone: "Asia/Shanghai",
    });
  }

  return events;
}

export async function deleteAppCalendar(): Promise<void> {
  const hasPermission = await requestCalendarPermission();
  if (!hasPermission) return;

  const calendarId = await findAppCalendar();
  if (calendarId) {
    await Calendar.deleteCalendarAsync(calendarId);
  }
}
