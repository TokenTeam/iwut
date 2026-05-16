import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import { getCurrentWeek, getTermWeekMonday } from "@/lib/date";
import { t } from "@/lib/i18n";
import {
  cancelAll,
  createChannel,
  scheduleCountdown,
  showCountdown,
} from "@/modules/notification";
import { SECTION_TIMES } from "@/services/course-time";
import { useCourseStore } from "@/store/course";
import { useSettingsStore } from "@/store/settings";

const CHANNEL_ID = "course_reminder";
const BACKGROUND_TASK_NAME = "course-reminder-refresh";
const SCHEDULE_WEEKS = 2;
const LIVE_ACTIVITY_ID = 9999;

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
    const [startH, startM] = startTimeStr.split(":").map(Number);

    const monday = getTermWeekMonday(termStart, currentWeek);
    if (!monday) continue;

    const courseDate = new Date(monday);
    courseDate.setDate(courseDate.getDate() + course.day - 1);
    courseDate.setHours(startH, startM, 0, 0);

    const classStartMs = courseDate.getTime();
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

export async function scheduleWeeklyReminders(): Promise<void> {
  const { courseReminder, reminderMinutes } = useSettingsStore.getState();

  await cancelAll();

  if (!courseReminder) return;

  const { courses, termStart } = useCourseStore.getState();
  if (!termStart || courses.length === 0) return;

  const currentWeek = getCurrentWeek(termStart);
  const now = Date.now();
  let idCounter = 0;

  for (let offset = 0; offset < SCHEDULE_WEEKS; offset++) {
    const week = currentWeek + offset;
    const monday = getTermWeekMonday(termStart, week);
    if (!monday) continue;

    for (const course of courses) {
      if (week < course.weekStart || week > course.weekEnd) continue;

      const sectionTime = SECTION_TIMES[course.sectionStart];
      if (!sectionTime) continue;

      const [startTimeStr] = sectionTime;
      const [startH, startM] = startTimeStr.split(":").map(Number);

      const courseDate = new Date(monday);
      courseDate.setDate(courseDate.getDate() + course.day - 1);
      courseDate.setHours(startH, startM, 0, 0);

      const classStartMs = courseDate.getTime();
      const triggerAtMs = classStartMs - reminderMinutes * 60 * 1000;

      if (triggerAtMs <= now) continue;

      await scheduleCountdown(
        idCounter++,
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
