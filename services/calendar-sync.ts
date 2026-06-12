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

import { getTermClassTimeMs } from "@/lib/date";
import { t } from "@/lib/i18n";
import enJson from "@/lib/i18n/locales/en.json";
import zhJson from "@/lib/i18n/locales/zh.json";
import { reportError } from "@/lib/report";
import { getMMKV } from "@/lib/storage";
import { createTaskQueue } from "@/lib/task-queue";
import { SECTION_TIMES } from "@/services/course-time";
import { type Course, useCourseStore } from "@/store/course";
import { useSettingsStore } from "@/store/settings";

// Calendar entries are re-created on every sync, so we use the current locale
// at sync time rather than caching a value at module load.
function getCalendarTitle(): string {
  return t("calSync.title");
}

// iOS 无法像 Android 那样用固定 name 定位日历，因此持久化创建出的日历 id，
// 并用所有语言的标题做兜底匹配，避免切换语言后产生残留/重复日历。
const CALENDAR_ID_STORAGE_KEY = "calendar-sync.calendarId";
const KNOWN_CALENDAR_TITLES = new Set([
  zhJson.calSync.title,
  enJson.calSync.title,
]);

function getStoredCalendarId(): string | null {
  return getMMKV().getString(CALENDAR_ID_STORAGE_KEY) ?? null;
}

function setStoredCalendarId(id: string | null): void {
  if (id == null) {
    getMMKV().remove(CALENDAR_ID_STORAGE_KEY);
  } else {
    getMMKV().set(CALENDAR_ID_STORAGE_KEY, id);
  }
}
const CALENDAR_COLOR = "#007AFF";
// Android 上用作 ACCOUNT_NAME / OWNER_ACCOUNT 的固定标识，使用 ASCII 字符以
// 避开部分 OEM Calendar Provider 对非 ASCII 账户名的隐式拒绝。
const APP_ACCOUNT_NAME = "iwut.tokenteam.dev";
// Android Calendars.NAME 与 Calendar.title 独立，便于多语言切换后定位。
const CALENDAR_INTERNAL_NAME = "iwut_schedule";

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
  const storedId = getStoredCalendarId();
  if (storedId && c.id === storedId) return true;
  return KNOWN_CALENDAR_TITLES.has(c.title ?? "");
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

function formatEventDateForReport(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  return String(value);
}

// 同步与删除都是"先清理再重建/移除"的多步流程，必须串行执行，
// 否则课程变更连续触发时可能产生重复日历或残留事件。
const calendarQueue = createTaskQueue();

export function syncCoursesToCalendar(): Promise<{
  success: boolean;
  count: number;
  failed: number;
  error?: string;
}> {
  return calendarQueue(doSyncCoursesToCalendar);
}

async function doSyncCoursesToCalendar(): Promise<{
  success: boolean;
  count: number;
  failed: number;
  error?: string;
}> {
  const hasPermission = await requestCalendarPermission();
  if (!hasPermission) {
    return {
      success: false,
      count: 0,
      failed: 0,
      error: t("calSync.errNoPermission"),
    };
  }

  const { courses, termStart } = useCourseStore.getState();
  if (!termStart || courses.length === 0) {
    return {
      success: false,
      count: 0,
      failed: 0,
      error: t("calSync.errNoData"),
    };
  }

  const reminderMinutes = useSettingsStore.getState().reminderMinutes;
  // expo-calendar/next 在 Android 上把 relativeOffset 直接写入 Reminders.MINUTES，
  // iOS 仍是 EventKit 的相对起始时间偏移。
  const reminderOffset =
    Platform.OS === "android" ? reminderMinutes : -reminderMinutes;

  // 每次同步先彻底清理旧日历再重建
  const stale = await findAppCalendars();
  for (const cal of stale) {
    await deleteCalendarSafe(cal);
  }
  setStoredCalendarId(null);

  let calendar: ExpoCalendar | null = null;

  try {
    calendar = await createAppCalendar();
    setStoredCalendarId(calendar.id);

    if (Platform.OS === "android") {
      await new Promise((r) => setTimeout(r, 200));
    }

    let count = 0;
    let failed = 0;
    let reported = false;
    for (const course of courses) {
      const events = createEventsForCourse(course, termStart, reminderOffset);
      for (const eventData of events) {
        try {
          await calendar.createEvent(eventData);
          count++;
        } catch (e) {
          failed++;
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
      setStoredCalendarId(null);
      return {
        success: false,
        count: 0,
        failed,
        error: t("calSync.errWriteFail"),
      };
    }
    return { success: true, count, failed };
  } catch (e) {
    reportError(e, {
      module: "calendar-sync",
      platform: Platform.OS,
      platformVersion: String(Platform.Version),
    });
    if (calendar) {
      await deleteCalendarSafe(calendar);
      setStoredCalendarId(null);
    }
    const msg = e instanceof Error ? e.message : t("calSync.errUnknown");
    return { success: false, count: 0, failed: 0, error: msg };
  }
}

type EventInput = Omit<Partial<ExpoCalendarEvent>, "id" | "organizer">;

function createEventsForCourse(
  course: Course,
  termStart: string,
  reminderOffset: number,
): EventInput[] {
  const events: EventInput[] = [];

  for (let week = course.weekStart; week <= course.weekEnd; week++) {
    const startTime = SECTION_TIMES[course.sectionStart];
    const endTime = SECTION_TIMES[course.sectionEnd];
    if (!startTime || !endTime) continue;

    const startMs = getTermClassTimeMs(
      termStart,
      week,
      course.day,
      startTime[0],
    );
    const endMs = getTermClassTimeMs(termStart, week, course.day, endTime[1]);
    if (startMs == null || endMs == null || startMs >= endMs) continue;

    const startDate = new Date(startMs);
    const endDate = new Date(endMs);

    events.push({
      title: course.name,
      location: formatLocation(course.room),
      // next API 会把 Date 转成 ISO 字符串；Android 原生 EventInputRecord 需要 string。
      startDate,
      endDate,
      alarms: [{ relativeOffset: reminderOffset }],
      notes: course.teacher
        ? t("calSync.teacherNotes", { teacher: course.teacher })
        : undefined,
      timeZone: "Asia/Shanghai",
    });
  }

  return events;
}

export function deleteAppCalendar(): Promise<void> {
  return calendarQueue(async () => {
    const hasPermission = await requestCalendarPermission();
    if (!hasPermission) return;

    const calendars = await findAppCalendars();
    for (const cal of calendars) {
      await deleteCalendarSafe(cal);
    }
    setStoredCalendarId(null);
  });
}
