import * as Calendar from "expo-calendar";
import { Platform } from "react-native";

import { getTermWeekMonday } from "@/lib/date";
import { reportError } from "@/lib/report";
import { SECTION_TIMES } from "@/services/course-time";
import { type Course, useCourseStore } from "@/store/course";

const CALENDAR_TITLE = "掌上吾理-我的课表";
const CALENDAR_COLOR = "#007AFF";

export async function requestCalendarPermission(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === "granted";
}

async function findAppCalendar(): Promise<string | null> {
  const calendars = await Calendar.getCalendarsAsync(
    Calendar.EntityTypes.EVENT,
  );
  const found = calendars.find((c) => c.title === CALENDAR_TITLE);
  return found?.id ?? null;
}

async function createAppCalendar(): Promise<string> {
  if (Platform.OS === "ios") {
    const defaultCalendar = await Calendar.getDefaultCalendarAsync();
    const id = await Calendar.createCalendarAsync({
      title: CALENDAR_TITLE,
      color: CALENDAR_COLOR,
      entityType: Calendar.EntityTypes.EVENT,
      sourceId: defaultCalendar.source.id,
      source: defaultCalendar.source,
      name: CALENDAR_TITLE,
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
    title: CALENDAR_TITLE,
    color: CALENDAR_COLOR,
    entityType: Calendar.EntityTypes.EVENT,
    sourceId: localSource?.id,
    source:
      localSource ??
      ({
        isLocalAccount: true,
        name: CALENDAR_TITLE,
        type: Calendar.SourceType?.LOCAL ?? ("LOCAL" as Calendar.SourceType),
      } as Calendar.Source),
    name: CALENDAR_TITLE,
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
    return { success: false, count: 0, error: "没有日历访问权限" };
  }

  const { courses, termStart } = useCourseStore.getState();
  if (!termStart || courses.length === 0) {
    return { success: false, count: 0, error: "没有课程数据或学期开始时间" };
  }

  try {
    // 每次同步先删除旧日历再重建
    const existingId = await findAppCalendar();
    if (existingId) {
      await Calendar.deleteCalendarAsync(existingId);
    }

    const calendarId = await createAppCalendar();

    let count = 0;
    for (const course of courses) {
      const events = createEventsForCourse(course, termStart);
      for (const eventData of events) {
        await Calendar.createEventAsync(calendarId, eventData);
        count++;
      }
    }

    return { success: true, count };
  } catch (e) {
    reportError(e, { module: "calendar-sync" });
    const msg = e instanceof Error ? e.message : "未知错误";
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
      startDate,
      endDate,
      alarms: [{ relativeOffset: -15 }],
      notes: course.teacher ? `教师: ${course.teacher}` : undefined,
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
