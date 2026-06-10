import {
  CalendarAccessLevel,
  createCalendar,
  EntityTypes,
  type ExpoCalendar,
  type ExpoCalendarEvent,
  getCalendars,
  getDefaultCalendarSync,
  requestCalendarPermissions,
  SourceType,
} from "expo-calendar/next";
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
// Android 上用作 ACCOUNT_NAME / OWNER_ACCOUNT 的固定标识，使用 ASCII 字符以
// 避开部分 OEM Calendar Provider 对非 ASCII 账户名的隐式拒绝。
const APP_ACCOUNT_NAME = "iwut.tokenteam.dev";
// Android Calendars.NAME 与 Calendar.title 独立，便于多语言切换后定位。
const CALENDAR_INTERNAL_NAME = "iwut_schedule";
// expo-calendar/next 在 Android 上会把 relativeOffset 直接写入
// CalendarContract.Reminders.MINUTES，而 iOS 仍使用 EventKit 的相对起始时间偏移。
const COURSE_REMINDER_OFFSET_MINUTES = Platform.OS === "android" ? 30 : -30;

export async function requestCalendarPermission(): Promise<boolean> {
  const { status } = await requestCalendarPermissions();
  return status === "granted";
}

function isAppCalendar(c: ExpoCalendar): boolean {
  if (Platform.OS === "android") {
    return (
      c.name === CALENDAR_INTERNAL_NAME || c.source?.name === APP_ACCOUNT_NAME
    );
  }
  return (c.title ?? "") === t("calSync.title");
}

async function findAppCalendars(): Promise<ExpoCalendar[]> {
  const calendars = await getCalendars(EntityTypes.EVENT);
  return calendars.filter(isAppCalendar);
}

async function deleteCalendarSafe(calendar: ExpoCalendar): Promise<void> {
  try {
    await calendar.delete();
  } catch {
    // 清理动作不应阻塞主流程
  }
}

async function createAppCalendar(): Promise<ExpoCalendar> {
  const title = getCalendarTitle();
  if (Platform.OS === "ios") {
    const defaultCalendar = getDefaultCalendarSync();
    return createCalendar({
      title,
      color: CALENDAR_COLOR,
      entityType: EntityTypes.EVENT,
      sourceId: defaultCalendar.source.id,
      source: defaultCalendar.source,
      name: title,
      ownerAccount: "personal",
      accessLevel: CalendarAccessLevel.OWNER,
    });
  }

  // Android 固定使用 ASCII ACCOUNT_NAME + LOCAL source，并显式开启 isVisible /
  // isSynced / allowsModifications。Android 文档建议这些字段为 true，避免 Calendar
  // Provider 行为异常；同时使用 ASCII OWNER_ACCOUNT 与 source.name 保持一致，便于
  // 多语言切换后通过 source.name 重新定位本应用的日历。
  return createCalendar({
    title,
    name: CALENDAR_INTERNAL_NAME,
    color: CALENDAR_COLOR,
    entityType: EntityTypes.EVENT,
    source: {
      isLocalAccount: true,
      name: APP_ACCOUNT_NAME,
      type: SourceType?.LOCAL ?? ("LOCAL" as SourceType),
    },
    ownerAccount: APP_ACCOUNT_NAME,
    accessLevel: CalendarAccessLevel.OWNER,
    isVisible: true,
    isSynced: true,
    allowsModifications: true,
  });
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

function formatEventDateForReport(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  return String(value);
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

  // 每次同步先彻底清理旧日历再重建
  const stale = await findAppCalendars();
  for (const cal of stale) {
    await deleteCalendarSafe(cal);
  }

  let calendar: ExpoCalendar | null = null;

  try {
    calendar = await createAppCalendar();

    if (Platform.OS === "android") {
      await new Promise((r) => setTimeout(r, 200));
    }

    let count = 0;
    let reported = false;
    for (const course of courses) {
      const events = createEventsForCourse(course, termStart);
      for (const eventData of events) {
        try {
          await calendar.createEvent(eventData);
          count++;
        } catch (e) {
          if (!reported) {
            // 仅上报首个失败事件，附带足以定位的上下文
            reported = true;
            reportError(e, {
              module: "calendar-sync",
              course: course.name,
              day: course.day,
              section: `${course.sectionStart}-${course.sectionEnd}`,
              calendarId: calendar.id,
              startDate: formatEventDateForReport(eventData.startDate),
              endDate: formatEventDateForReport(eventData.endDate),
              timeZone: eventData.timeZone,
              platform: Platform.OS,
              platformVersion: String(Platform.Version),
            });
          }
        }
      }
    }

    if (count === 0) {
      // 彻底失败时应删掉空日历
      await deleteCalendarSafe(calendar);
      return { success: false, count: 0, error: t("calSync.errWriteFail") };
    }
    return { success: true, count };
  } catch (e) {
    reportError(e, {
      module: "calendar-sync",
      platform: Platform.OS,
      platformVersion: String(Platform.Version),
    });
    if (calendar) {
      await deleteCalendarSafe(calendar);
    }
    const msg = e instanceof Error ? e.message : t("calSync.errUnknown");
    return { success: false, count: 0, error: msg };
  }
}

type EventInput = Omit<Partial<ExpoCalendarEvent>, "id" | "organizer">;

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
      // next API 会把 Date 转成 ISO 字符串；Android 原生 EventInputRecord 需要 string。
      startDate,
      endDate,
      alarms: [{ relativeOffset: COURSE_REMINDER_OFFSET_MINUTES }],
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

  const calendars = await findAppCalendars();
  for (const cal of calendars) {
    await deleteCalendarSafe(cal);
  }
}
