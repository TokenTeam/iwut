import {
  CalendarAccessLevel,
  createCalendar,
  EntityTypes,
  type ExpoCalendar,
  ExpoCalendarEvent,
  Frequency,
  getCalendars,
  getDefaultCalendarSync,
  requestCalendarPermissions,
  SourceType,
} from "expo-calendar/next";
import { Platform } from "react-native";

import { getTermClassTimeMs } from "@/lib/date";
import { t } from "@/lib/i18n";
import { reportError } from "@/lib/report";
import { getMMKV } from "@/lib/storage";
import { createTaskQueue } from "@/lib/task-queue";
import { SECTION_TIMES } from "@/services/course-time";
import { type Course, useCourseStore } from "@/store/course";
import { useSettingsStore } from "@/store/settings";

// iOS 仅按持久化 ID 识别应用日历，避免误删用户创建的同名日历。
const CALENDAR_ID_STORAGE_KEY = "calendar-sync.calendarId";

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

// 外部日历中的事件只能按创建时记录的 ID 删除。
const SYNCED_EVENT_IDS_KEY = "calendar-sync.eventIds";

function getStoredEventIds(): string[] {
  const raw = getMMKV().getString(SYNCED_EVENT_IDS_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function setStoredEventIds(ids: string[]): void {
  if (ids.length === 0) {
    getMMKV().remove(SYNCED_EVENT_IDS_KEY);
  } else {
    getMMKV().set(SYNCED_EVENT_IDS_KEY, JSON.stringify(ids));
  }
}

const CALENDAR_COLOR = "#007AFF";
const ANDROID_CALENDAR_READY_DELAY_MS = 200;
// 部分 Android 日历 Provider 会拒绝非 ASCII 账户名。
const APP_ACCOUNT_NAME = "iwut.tokenteam.dev";
const CALENDAR_INTERNAL_NAME = "iwut_schedule";

export async function requestCalendarPermission(): Promise<boolean> {
  const { status } = await requestCalendarPermissions();
  return status === "granted";
}

function isAppCalendar(calendar: ExpoCalendar): boolean {
  if (Platform.OS === "android") {
    return (
      calendar.name === CALENDAR_INTERNAL_NAME ||
      calendar.source?.name === APP_ACCOUNT_NAME
    );
  }
  const storedId = getStoredCalendarId();
  return storedId != null && calendar.id === storedId;
}

async function findAppCalendars(): Promise<ExpoCalendar[]> {
  const calendars = await getCalendars(EntityTypes.EVENT);
  return calendars.filter(isAppCalendar);
}

async function deleteCalendarSafe(calendar: ExpoCalendar): Promise<boolean> {
  try {
    await calendar.delete();
    return true;
  } catch {
    return false;
  }
}

async function createAppCalendar(): Promise<ExpoCalendar> {
  const title = t("calSync.title");
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

  return createCalendar({
    title,
    name: CALENDAR_INTERNAL_NAME,
    color: CALENDAR_COLOR,
    entityType: EntityTypes.EVENT,
    source: {
      isLocalAccount: true,
      name: APP_ACCOUNT_NAME,
      type: SourceType.LOCAL,
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

export interface CalendarInfo {
  id: string;
  title: string;
  color?: string;
  accountName: string;
}

function toCalendarInfo(calendar: ExpoCalendar): CalendarInfo {
  return {
    id: calendar.id,
    title: calendar.title || "—",
    color: calendar.color ?? undefined,
    accountName: calendar.source?.name ?? "",
  };
}

export const APP_LOCAL_CALENDAR_ID = "__iwut_local__";

export async function getWritableCalendars(): Promise<CalendarInfo[]> {
  const calendars = await getCalendars(EntityTypes.EVENT);
  return calendars
    .filter(
      (calendar) =>
        !isAppCalendar(calendar) &&
        calendar.allowsModifications &&
        (Platform.OS !== "android" || calendar.isPrimary),
    )
    .map(toCalendarInfo);
}

const calendarQueue = createTaskQueue();

interface SyncResult {
  success: boolean;
  count: number;
  failed: number;
  error?: string;
}

export function syncCoursesToCalendar(
  targetCalendarIds?: string[],
): Promise<SyncResult> {
  return calendarQueue(async () => {
    try {
      return await doSyncCoursesToCalendar(targetCalendarIds);
    } catch (error) {
      reportError(error, {
        module: "calendar-sync",
        operation: "sync",
        platform: Platform.OS,
        platformVersion: String(Platform.Version),
      });
      return {
        success: false,
        count: 0,
        failed: 0,
        error: error instanceof Error ? error.message : t("calSync.errUnknown"),
      };
    }
  });
}

async function doSyncCoursesToCalendar(
  targetCalendarIds?: string[],
): Promise<SyncResult> {
  const { courses, termStart } = useCourseStore.getState();
  if (!termStart || courses.length === 0) {
    return {
      success: false,
      count: 0,
      failed: 0,
      error: t("calSync.errNoData"),
    };
  }

  const hasPermission = await requestCalendarPermission();
  if (!hasPermission) {
    return {
      success: false,
      count: 0,
      failed: 0,
      error: t("calSync.errNoPermission"),
    };
  }

  const reminderMinutes = useSettingsStore.getState().reminderMinutes;
  // Android 使用正数分钟，iOS 使用相对开始时间的负偏移。
  const reminderOffset =
    Platform.OS === "android" ? reminderMinutes : -reminderMinutes;

  const requestedIds = new Set(targetCalendarIds ?? []);
  const useLocalCalendar =
    requestedIds.size === 0 || requestedIds.has(APP_LOCAL_CALENDAR_ID);
  requestedIds.delete(APP_LOCAL_CALENDAR_ID);

  // 新事件成功写入前保留旧数据，避免同步失败后丢失已有日程。
  const calendars = await getCalendars(EntityTypes.EVENT);
  const staleAppCalendars = calendars.filter(isAppCalendar);
  const oldExternalEventIds = getStoredEventIds();

  const targets: ExpoCalendar[] = [];
  let newAppCalendar: ExpoCalendar | null = null;
  let unresolvedTargetCount = 0;

  if (requestedIds.size > 0) {
    const resolvedExternalIds = new Set<string>();
    for (const calendar of calendars) {
      if (
        requestedIds.has(calendar.id) &&
        calendar.allowsModifications &&
        !isAppCalendar(calendar)
      ) {
        targets.push(calendar);
        resolvedExternalIds.add(calendar.id);
      }
    }
    unresolvedTargetCount += requestedIds.size - resolvedExternalIds.size;
  }

  if (useLocalCalendar) {
    try {
      newAppCalendar = await createAppCalendar();
      targets.push(newAppCalendar);
      if (Platform.OS === "android") {
        await new Promise((resolve) =>
          setTimeout(resolve, ANDROID_CALENDAR_READY_DELAY_MS),
        );
      }
    } catch (error) {
      reportError(error, { module: "calendar-sync", platform: Platform.OS });
      unresolvedTargetCount++;
      if (targets.length === 0) {
        return {
          success: false,
          count: 0,
          failed: 0,
          error:
            error instanceof Error ? error.message : t("calSync.errUnknown"),
        };
      }
    }
  }

  if (targets.length === 0) {
    return {
      success: false,
      count: 0,
      failed: 0,
      error: t("calSync.errWriteFail"),
    };
  }

  const courseEvents = courses.flatMap((course) => {
    const event = createEventForCourse(course, termStart, reminderOffset);
    return event ? [{ course, event }] : [];
  });
  let count = 0;
  let failed = unresolvedTargetCount * courseEvents.length;
  let reported = false;
  const createdExternalIds: string[] = [];

  for (const calendar of targets) {
    for (const { course, event } of courseEvents) {
      try {
        const created = await calendar.createEvent(event);
        count++;
        if (calendar !== newAppCalendar && created?.id) {
          createdExternalIds.push(created.id);
        }
      } catch (error) {
        failed++;
        if (!reported) {
          reported = true;
          reportError(error, {
            module: "calendar-sync",
            course: course.name,
            day: course.day,
            section: `${course.sectionStart}-${course.sectionEnd}`,
            calendarId: calendar.id,
            startDate: formatEventDateForReport(event.startDate),
            endDate: formatEventDateForReport(event.endDate),
            timeZone: event.timeZone,
            platform: Platform.OS,
            platformVersion: String(Platform.Version),
          });
        }
      }
    }
  }

  if (count === 0) {
    if (newAppCalendar) await deleteCalendarSafe(newAppCalendar);
    return {
      success: false,
      count: 0,
      failed,
      error: t("calSync.errWriteFail"),
    };
  }

  for (const calendar of staleAppCalendars) {
    await deleteCalendarSafe(calendar);
  }
  setStoredCalendarId(newAppCalendar?.id ?? null);

  const failedOldEventIds = await deleteEventIds(oldExternalEventIds);
  setStoredEventIds([...failedOldEventIds, ...createdExternalIds]);

  const resolvedCalendarIds = targets.map((calendar) =>
    calendar === newAppCalendar ? APP_LOCAL_CALENDAR_ID : calendar.id,
  );
  useSettingsStore.getState().setSyncedCalendarIds(resolvedCalendarIds);

  return { success: true, count, failed };
}

type EventInput = Omit<Partial<ExpoCalendarEvent>, "id" | "organizer">;

function createEventForCourse(
  course: Course,
  termStart: string,
  reminderOffset: number,
): EventInput | null {
  const startTime = course.startTime || SECTION_TIMES[course.sectionStart]?.[0];
  const endTime = course.endTime || SECTION_TIMES[course.sectionEnd]?.[1];
  if (!startTime || !endTime) return null;

  // 每个课程时段只创建一个按周重复事件，减少云日历写入量。
  const startMs = getTermClassTimeMs(
    termStart,
    course.weekStart,
    course.day,
    startTime,
  );
  const endMs = getTermClassTimeMs(
    termStart,
    course.weekStart,
    course.day,
    endTime,
  );
  if (startMs == null || endMs == null || startMs >= endMs) return null;

  const occurrence = course.weekEnd - course.weekStart + 1;
  if (occurrence < 1) return null;

  const event: EventInput = {
    title: course.name,
    location: formatLocation(course.room),
    startDate: new Date(startMs),
    endDate: new Date(endMs),
    alarms: [{ relativeOffset: reminderOffset }],
    notes: course.teacher
      ? t("calSync.teacherNotes", { teacher: course.teacher })
      : undefined,
    timeZone: "Asia/Shanghai",
  };

  if (occurrence > 1) {
    event.recurrenceRule = {
      frequency: Frequency.WEEKLY,
      interval: 1,
      occurrence,
    };
  }

  return event;
}

async function deleteEventIds(ids: string[]): Promise<string[]> {
  const failedIds: string[] = [];
  for (const id of ids) {
    let event: ExpoCalendarEvent;
    try {
      event = await ExpoCalendarEvent.get(id);
    } catch {
      continue;
    }
    try {
      await event.delete();
    } catch {
      failedIds.push(id);
    }
  }
  return failedIds;
}

interface RemoveSyncResult {
  success: boolean;
  error?: string;
}

async function doRemoveSyncedCalendarData(
  preserveTargets: boolean,
): Promise<RemoveSyncResult> {
  try {
    const hasPermission = await requestCalendarPermission();
    if (!hasPermission) {
      return { success: false, error: t("calSync.errNoPermission") };
    }

    const appCalendars = await findAppCalendars();
    const appCalendarResults = await Promise.all(
      appCalendars.map(deleteCalendarSafe),
    );
    const failedEventIds = await deleteEventIds(getStoredEventIds());
    setStoredEventIds(failedEventIds);

    const appCalendarsRemoved = appCalendarResults.every(Boolean);
    if (!appCalendarsRemoved || failedEventIds.length > 0) {
      return { success: false, error: t("calSync.errWriteFail") };
    }

    setStoredCalendarId(null);
    if (!preserveTargets) useSettingsStore.getState().setSyncedCalendarIds([]);
    return { success: true };
  } catch (error) {
    reportError(error, {
      module: "calendar-sync",
      operation: "delete",
      platform: Platform.OS,
      platformVersion: String(Platform.Version),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : t("calSync.errUnknown"),
    };
  }
}

export function clearSyncedCalendarData(): Promise<RemoveSyncResult> {
  return calendarQueue(() => doRemoveSyncedCalendarData(true));
}

export function deleteAppCalendar(): Promise<RemoveSyncResult> {
  return calendarQueue(() => doRemoveSyncedCalendarData(false));
}
