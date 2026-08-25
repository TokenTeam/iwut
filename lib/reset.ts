import { reloadAppAsync } from "expo";
import { getCalendarPermissions } from "expo-calendar/next";
import { Image } from "expo-image";
import * as TaskManager from "expo-task-manager";
import { Appearance, Platform } from "react-native";
import { createMMKV } from "react-native-mmkv";

import { IS_DEV } from "@/constants/is-dev";
import { getMMKV } from "@/lib/storage";
import { setApplicationLocales } from "@/modules/locale";
import { cancelAll } from "@/modules/notification";
import { resetNativeData } from "@/modules/reset";
import { reloadWidgets } from "@/modules/widget";
import { deleteAppCalendar } from "@/services/calendar-sync";

async function bestEffort(task: () => Promise<unknown>): Promise<void> {
  try {
    await task();
  } catch {}
}

export async function resetDataAndReload(): Promise<void> {
  if (!IS_DEV) {
    throw new Error("Reset is disabled in this build.");
  }

  await bestEffort(cancelAll);
  await bestEffort(TaskManager.unregisterAllTasksAsync);
  await bestEffort(async () => {
    const calendarPermission = await getCalendarPermissions();
    if (calendarPermission.status === "granted") {
      await deleteAppCalendar();
    }
  });

  await bestEffort(Image.clearMemoryCache);

  getMMKV().clearAll();
  createMMKV({ id: "rpc_apps" }).clearAll();

  await resetNativeData();
  Appearance.setColorScheme("unspecified");
  if (Platform.OS === "android") {
    await bestEffort(async () => {
      await setApplicationLocales(null);
    });
  }
  await bestEffort(reloadWidgets);
  await reloadAppAsync("Reset");
}
