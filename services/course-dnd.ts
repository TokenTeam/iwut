import { Platform } from "react-native";

import { buildCourseDndIntervals } from "@/lib/course-dnd";
import { t } from "@/lib/i18n";
import { createTaskQueue } from "@/lib/task-queue";
import { getCourseDndStatus, updateCourseDnd } from "@/modules/notification";
import { useCourseStore } from "@/store/course";
import { useSettingsStore } from "@/store/settings";

const queue = createTaskQueue();

async function update(enabled: boolean): Promise<void> {
  const { courses, termStart } = useCourseStore.getState();
  await updateCourseDnd(
    enabled,
    JSON.stringify(buildCourseDndIntervals(courses, termStart)),
    t("settings.courseDnd"),
  );
}

export function setCourseDndEnabled(enabled: boolean): Promise<void> {
  return queue(async () => {
    const status = await getCourseDndStatus();
    if (enabled && (!status.policyAccess || !status.exactAlarmAccess)) {
      throw new Error("Course DND permissions are unavailable");
    }
    const previous = useSettingsStore.getState().courseDnd;
    try {
      await update(enabled);
      if (enabled) {
        const current = await getCourseDndStatus();
        if (
          !current.policyAccess ||
          !current.exactAlarmAccess ||
          !current.ruleEnabled
        ) {
          throw new Error("Course DND rule could not be enabled");
        }
      }
    } catch (error) {
      // A partially completed native update must not leave an untracked active rule.
      await update(previous).catch(() => {});
      throw error;
    }
    useSettingsStore.getState().setCourseDnd(enabled);
  });
}

export function syncCourseDnd(): Promise<void> {
  return queue(async () => {
    if (Platform.OS !== "android") return;
    await update(useSettingsStore.getState().courseDnd);
  });
}
