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
import enJson from "@/lib/i18n/locales/en.json";
import zhJson from "@/lib/i18n/locales/zh.json";
import { reportError } from "@/lib/report";
import { getMMKV } from "@/lib/storage";
import { createTaskQueue } from "@/lib/task-queue";
import { SECTION_TIMES } from "@/services/course-time";
import { type Course, useCourseStore } from "@/store/course";
import { useSettingsStore } from "@/store/settings";

// Calendar entries are re-created on every sync, so we read the current locale
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

// Event ids we created in *external* (user-chosen) calendars. The app-owned
// calendar is removed wholesale, but events written into a user's own calendar
// must be deleted by their exact ids — never by title, which could wipe the
// user's unrelated events that happen to share a course name.
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

// ─── Writable calendar discovery ───────────────────────────────────

export interface CalendarInfo {
  id: string;
  title: string;
  color: string | undefined;
  accountName: string;
  accountType: string;
  isLocal: boolean;
  isPrimary: boolean;
}

export interface WritableCalendars {
  /**
   * Writable calendars to offer as sync targets. On Android only calendars
   * flagged as the account's primary calendar are included (one per account),
   * to avoid listing sub-calendars like holidays / birthdays. On iOS, where
   * `isPrimary` is unavailable, all writable calendars are returned.
   */
  others: CalendarInfo[];
}

function toCalendarInfo(c: ExpoCalendar): CalendarInfo {
  return {
    id: c.id,
    title: c.title || "—",
    color: c.color ?? undefined,
    accountName: c.source?.name ?? "",
    accountType: String(c.source?.type ?? ""),
    isLocal: !!c.source?.isLocalAccount,
    isPrimary: !!c.isPrimary,
  };
}

/**
 * Special calendar ID used when the user chooses the app-created local calendar
 * rather than an existing system calendar.
 */
export const APP_LOCAL_CALENDAR_ID = "__iwut_local__";

export async function getWritableCalendars(): Promise<WritableCalendars> {
  const all = await getCalendars(EntityTypes.EVENT);
  const others = all
    .filter((c) => {
      if (!c.allowsModifications) return false;
      // Android exposes `isPrimary`; keep only primary calendars so the list
      // shows one entry per account instead of every sub-calendar.
      if (Platform.OS === "android") return !!c.isPrimary;
      // iOS has no `isPrimary`; offer all writable calendars.
      return true;
    })
    .map(toCalendarInfo);
  return { others };
}

// ─── Sync queue ────────────────────────────────────────────────────

// 同步与删除都是“先清理再重建/移除”的多步流程，必须串行执行，
// 否则课程变更连续触发时可能产生重复日历或残留事件。
const calendarQueue = createTaskQueue();

export interface SyncResult {
  success: boolean;
  count: number;
  failed: number;
  error?: string;
}

/**
 * Sync courses to specified calendars (by their IDs).
 * When `targetCalendarIds` is empty / undefined the legacy behavior is used:
 * create a dedicated app calendar and write there.
 */
export function syncCoursesToCalendar(
  targetCalendarIds?: string[],
): Promise<SyncResult> {
  return calendarQueue(() => doSyncCoursesToCalendar(targetCalendarIds));
}

async function doSyncCoursesToCalendar(
  targetCalendarIds?: string[],
): Promise<SyncResult> {
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

  // Normalize: replace the sentinel with null to trigger legacy path
  const hasLocalSentinel = targetCalendarIds?.includes(APP_LOCAL_CALENDAR_ID);
  const externalIds =
    targetCalendarIds?.filter((id) => id !== APP_LOCAL_CALENDAR_ID) ?? [];
  const useTargets = targetCalendarIds && targetCalendarIds.length > 0;

  // ── Clean up old events ──────────────────────────────────────────
  // Always clean up the legacy app-owned calendar (deleting the whole calendar
  // removes its events with it).
  const stale = await findAppCalendars();
  for (const cal of stale) {
    await deleteCalendarSafe(cal);
  }
  setStoredCalendarId(null);

  // Remove events we previously wrote into the user's own (external) calendars,
  // matched by their exact ids so unrelated user events are never touched.
  await deleteStoredEvents();

  // ── Resolve target calendars ─────────────────────────────────────
  // `external` distinguishes the user's own calendars (whose events we must
  // track + delete by id) from the disposable app-owned calendar.
  const targets: { cal: ExpoCalendar; external: boolean }[] = [];

  // If user chose the app-local calendar (or legacy mode with no args)
  if (hasLocalSentinel || !useTargets) {
    try {
      const calendar = await createAppCalendar();
      setStoredCalendarId(calendar.id);
      targets.push({ cal: calendar, external: false });
      if (Platform.OS === "android") {
        await new Promise((r) => setTimeout(r, 200));
      }
    } catch (e) {
      reportError(e, { module: "calendar-sync", platform: Platform.OS });
      const msg = e instanceof Error ? e.message : t("calSync.errUnknown");
      return { success: false, count: 0, failed: 0, error: msg };
    }
  }

  // Resolve external calendar targets
  if (externalIds.length > 0) {
    const all = await getCalendars(EntityTypes.EVENT);
    for (const c of all) {
      if (externalIds.includes(c.id) && c.allowsModifications) {
        targets.push({ cal: c, external: true });
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

  // ── Write events ─────────────────────────────────────────────────
  let count = 0;
  let failed = 0;
  let reported = false;
  // Ids of events created in external calendars, persisted for precise cleanup.
  const createdExternalIds: string[] = [];

  for (const { cal, external } of targets) {
    for (const course of courses) {
      const events = createEventsForCourse(course, termStart, reminderOffset);
      for (const eventData of events) {
        try {
          const created = await cal.createEvent(eventData);
          count++;
          if (external && created?.id) createdExternalIds.push(created.id);
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
              calendarId: cal.id,
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
  }

  if (count === 0) {
    // 彻底失败时应删掉空的应用日历
    if (!useTargets && targets.length === 1 && !targets[0].external) {
      await deleteCalendarSafe(targets[0].cal);
      setStoredCalendarId(null);
    }
    return {
      success: false,
      count: 0,
      failed,
      error: t("calSync.errWriteFail"),
    };
  }

  // Persist created external event ids + which calendars we wrote to, so the
  // next sync / removal knows exactly what to clean up.
  setStoredEventIds(createdExternalIds);
  useSettingsStore
    .getState()
    .setSyncedCalendarIds(targetCalendarIds ?? [APP_LOCAL_CALENDAR_ID]);

  return { success: true, count, failed };
}

type EventInput = Omit<Partial<ExpoCalendarEvent>, "id" | "organizer">;

function createEventsForCourse(
  course: Course,
  termStart: string,
  reminderOffset: number,
): EventInput[] {
  const startTime = SECTION_TIMES[course.sectionStart];
  const endTime = SECTION_TIMES[course.sectionEnd];
  if (!startTime || !endTime) return [];

  // Anchor the recurring event at the first week the course occurs, then let
  // a WEEKLY recurrence rule generate the remaining weeks. This writes one
  // event row per course slot instead of one per week — drastically fewer
  // rows for cloud-synced calendars (e.g. Google) to upload, so they appear
  // faster and in full.
  const startMs = getTermClassTimeMs(
    termStart,
    course.weekStart,
    course.day,
    startTime[0],
  );
  const endMs = getTermClassTimeMs(
    termStart,
    course.weekStart,
    course.day,
    endTime[1],
  );
  if (startMs == null || endMs == null || startMs >= endMs) return [];

  const occurrence = course.weekEnd - course.weekStart + 1;
  if (occurrence < 1) return [];

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

  // A single-week course needs no recurrence rule.
  if (occurrence > 1) {
    event.recurrenceRule = {
      frequency: Frequency.WEEKLY,
      interval: 1,
      occurrence,
    };
  }

  return [event];
}

// ─── Delete ────────────────────────────────────────────────────────

/**
 * Delete the events we created in the user's own (external) calendars, using
 * the exact ids captured at write time. A recurring event's base id deletes the
 * whole series, so each stored id removes one course slot entirely. Matching by
 * id (never by title) guarantees we never touch the user's unrelated events.
 */
async function deleteStoredEvents(): Promise<void> {
  const ids = getStoredEventIds();
  if (ids.length === 0) return;
  for (const id of ids) {
    try {
      const event = await ExpoCalendarEvent.get(id);
      await event.delete();
    } catch {
      // 事件可能已被用户手动删除，忽略即可
    }
  }
  setStoredEventIds([]);
}

/**
 * Remove all app-synced events. Called when the user toggles sync off.
 * Handles both legacy (app-owned calendar) and new (user-chosen calendars).
 */
export function deleteAppCalendar(): Promise<void> {
  return calendarQueue(async () => {
    const hasPermission = await requestCalendarPermission();
    if (!hasPermission) return;

    // Legacy / local cleanup: delete the app-owned calendar wholesale.
    const appCals = await findAppCalendars();
    for (const cal of appCals) {
      await deleteCalendarSafe(cal);
    }
    setStoredCalendarId(null);

    // New: delete the events we wrote into the user's own calendars by id.
    await deleteStoredEvents();
    useSettingsStore.getState().setSyncedCalendarIds([]);
  });
}
