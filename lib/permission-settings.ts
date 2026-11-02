import { applicationId } from "expo-application";
import type { IntentLauncherParams } from "expo-intent-launcher";
import { Linking, Platform } from "react-native";
import Toast from "react-native-toast-message";

import { t } from "@/lib/i18n";
import { reportError } from "@/lib/report";

export type PermissionSettingsTarget =
  "application" | "notification" | "policy" | "exact-alarm";

export async function openPermissionSettings(
  target: PermissionSettingsTarget = "application",
): Promise<void> {
  try {
    if (Platform.OS !== "android" || !applicationId) {
      await Linking.openSettings();
      return;
    }

    const { ActivityAction, startActivityAsync } =
      await import("expo-intent-launcher");
    const appSettings: IntentLauncherParams = {
      data: `package:${applicationId}`,
    };
    let action = ActivityAction.APPLICATION_DETAILS_SETTINGS;
    let params = appSettings;
    if (target === "notification" && Number(Platform.Version) >= 26) {
      action = ActivityAction.APP_NOTIFICATION_SETTINGS;
      params = {
        extra: { "android.provider.extra.APP_PACKAGE": applicationId },
      };
    } else if (target === "policy") {
      action = ActivityAction.NOTIFICATION_POLICY_ACCESS_SETTINGS;
      params = {};
    } else if (target === "exact-alarm" && Number(Platform.Version) >= 31) {
      action = ActivityAction.REQUEST_SCHEDULE_EXACT_ALARM;
    }

    try {
      await startActivityAsync(action, params);
    } catch {
      try {
        await startActivityAsync(
          ActivityAction.APPLICATION_DETAILS_SETTINGS,
          appSettings,
        );
      } catch {
        await Linking.openSettings();
      }
    }
  } catch (error) {
    reportError(error, { module: "permission-settings", target });
    Toast.show({
      type: "error",
      text1: t("common.openSettingsFailed"),
      position: "bottom",
    });
  }
}
