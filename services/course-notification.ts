import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { PermissionsAndroid, Platform } from "react-native";

import { getCurrentWeek, getTermClassTimeMs } from "@/lib/date";
import { t } from "@/lib/i18n";
import { createTaskQueue } from "@/lib/task-queue";
import {
  cancelAll,
  createChannel,
  requestAuthorization,
  scheduleCountdown,
  scheduleNotification,
  showCountdown,
} from "@/modules/notification";
import { SECTION_TIMES } from "@/services/course-time";
import { buildExamReminders } from "@/services/exam-notification";
import { useCourseStore } from "@/store/course";
import { useExamStore } from "@/store/exam";
import { useSettingsStore } from "@/store/settings";

const CHANNEL_ID = "course_reminder";
const EXAM_CHANNEL_ID = "exam_reminder";
const BACKGROUND_TASK_NAME = "course-reminder-refresh";
const SCHEDULE_WEEKS = 2;
const LIVE_ACTIVITY_ID = 9999;

export async function ensureCourseNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "android") {
    if (typeof Platform.Version === "number" && Platform.Version < 33) {
      return true;
    }

    const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
    const alreadyGranted = await PermissionsAndroid.check(permission);
    if (alreadyGranted) return true;

    const result = await PermissionsAndroid.request(permission);
    if (result === PermissionsAndroid.RESULTS.GRANTED) return true;

    return false;
  }

  if (Platform.OS === "ios") {
    const granted = await requestAuthorization();
    if (granted) return true;

    return false;
  }

  return true;
}

function hashReminderId(input: string): number {
  let hash = 0x811c9dc5;

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash & 0x7fffffff;
}

function getReminderId(
  termStart: string,
  week: number,
  course: {
    name: string;
    room: string;
    teacher: string;
    day: number;
    sectionStart: number;
    sectionEnd: number;
  },
  classStartMs: number,
): number {
  const id = hashReminderId(
    [
      termStart,
      week,
      course.day,
      course.sectionStart,
      course.sectionEnd,
      classStartMs,
      course.name,
      course.room,
      course.teacher,
    ].join("|"),
  );

  return id === LIVE_ACTIVITY_ID ? LIVE_ACTIVITY_ID + 1 : id;
}

function reserveReminderId(baseId: number, scheduledIds: Set<number>): number {
  let id = baseId;

  while (scheduledIds.has(id) || id === LIVE_ACTIVITY_ID) {
    id = (id + 1) & 0x7fffffff;
  }

  scheduledIds.add(id);
  return id;
}

TaskManager.defineTask(BACKGROUND_TASK_NAME, async () => {
  try {
    await initNotificationChannel();
    await scheduleWeeklyReminders();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundRefresh(): Promise<void> {
  const isRegistered =
    await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
  if (isRegistered) return;

  await BackgroundTask.registerTaskAsync(BACKGROUND_TASK_NAME, {
    minimumInterval: 60 * 6,
  });
}

export async function unregisterBackgroundRefresh(): Promise<void> {
  const isRegistered =
    await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
  if (!isRegistered) return;

  await BackgroundTask.unregisterTaskAsync(BACKGROUND_TASK_NAME);
}

export async function initNotificationChannel(): Promise<void> {
  if (Platform.OS === "android") {
    // Android caches the channel name/description after first creation, so
    // language changes won't update an already-created channel. Fresh installs
    // (or new channels) still pick up the current locale.
    await createChannel(
      CHANNEL_ID,
      t("notif.channelName"),
      t("notif.channelDesc"),
    );
    await createChannel(
      EXAM_CHANNEL_ID,
      t("notif.examChannelName"),
      t("notif.examChannelDesc"),
    );
  }
}

export async function showUpcomingLiveActivity(): Promise<void> {
  if (Platform.OS !== "ios") return;

  const { courseReminder, reminderMinutes } = useSettingsStore.getState();
  if (!courseReminder) return;

  const { courses, termStart } = useCourseStore.getState();
  if (!termStart || courses.length === 0) return;

  const currentWeek = getCurrentWeek(termStart);
  const now = Date.now();
  const windowMs = reminderMinutes * 60 * 1000;

  let nearest: { name: string; info: string; classStartMs: number } | null =
    null;

  for (const course of courses) {
    if (currentWeek < course.weekStart || currentWeek > course.weekEnd)
      continue;

    const sectionTime = SECTION_TIMES[course.sectionStart];
    if (!sectionTime) continue;

    const [startTimeStr] = sectionTime;
    const classStartMs = getTermClassTimeMs(
      termStart,
      currentWeek,
      course.day,
      startTimeStr,
    );
    if (classStartMs == null) continue;

    const triggerAtMs = classStartMs - windowMs;

    if (now >= triggerAtMs && now < classStartMs) {
      if (!nearest || classStartMs < nearest.classStartMs) {
        nearest = {
          name: course.name,
          info: `${course.room} · ${startTimeStr}`,
          classStartMs,
        };
      }
    }
  }

  if (nearest) {
    await showCountdown(
      LIVE_ACTIVITY_ID,
      CHANNEL_ID,
      nearest.name,
      nearest.info,
      nearest.classStartMs,
      true,
      true,
    );
  }
}

// "先 cancelAll 再逐条调度"必须串行执行，并发调用会注册重复通知
const reminderQueue = createTaskQueue();

export function scheduleWeeklyReminders(): Promise<void> {
  return reminderQueue(doScheduleWeeklyReminders);
}

async function doScheduleWeeklyReminders(): Promise<void> {
  const { courseReminder, examReminder, reminderMinutes } =
    useSettingsStore.getState();

  // 课程与考试提醒共用同一套通知 id 空间，先整体清空再统一重排，
  // 避免两者各自 cancelAll 时互相误删。
  await cancelAll();

  const scheduledIds = new Set<number>();
  const now = Date.now();

  if (courseReminder) {
    await scheduleCourseReminders(scheduledIds, reminderMinutes, now);
  }

  if (examReminder) {
    await scheduleExamReminders(scheduledIds, now);
  }
}

async function scheduleCourseReminders(
  scheduledIds: Set<number>,
  reminderMinutes: number,
  now: number,
): Promise<void> {
  const { courses, termStart } = useCourseStore.getState();
  if (!termStart || courses.length === 0) return;

  const currentWeek = getCurrentWeek(termStart);

  for (let offset = 0; offset < SCHEDULE_WEEKS; offset++) {
    const week = currentWeek + offset;

    for (const course of courses) {
      if (week < course.weekStart || week > course.weekEnd) continue;

      const sectionTime = SECTION_TIMES[course.sectionStart];
      if (!sectionTime) continue;

      const [startTimeStr] = sectionTime;
      const classStartMs = getTermClassTimeMs(
        termStart,
        week,
        course.day,
        startTimeStr,
      );
      if (classStartMs == null) continue;

      const triggerAtMs = classStartMs - reminderMinutes * 60 * 1000;

      if (triggerAtMs <= now) continue;

      const id = reserveReminderId(
        getReminderId(termStart, week, course, classStartMs),
        scheduledIds,
      );

      await scheduleCountdown(
        id,
        CHANNEL_ID,
        course.name,
        `${course.room} · ${startTimeStr}`,
        triggerAtMs,
        classStartMs,
        true,
        true,
      );
    }
  }
}

async function scheduleExamReminders(
  scheduledIds: Set<number>,
  now: number,
): Promise<void> {
  const { exams } = useExamStore.getState();
  if (exams.length === 0) return;

  const items = buildExamReminders(exams, now);

  for (const item of items) {
    const id = reserveReminderId(hashReminderId(item.key), scheduledIds);

    await scheduleNotification(
      id,
      EXAM_CHANNEL_ID,
      item.title,
      item.body,
      item.triggerAtMs,
    );
  }
}
