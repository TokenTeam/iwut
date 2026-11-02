import { useT } from "@/lib/i18n";
import {
  openPermissionSettings,
  type PermissionSettingsTarget,
} from "@/lib/permission-settings";

import { ConfirmSheet } from "./confirm-sheet";

export function PermissionSettingsSheet({
  target,
  onClose,
}: Readonly<{
  target: "calendar" | "notification" | "exact-alarm" | null;
  onClose: () => void;
}>) {
  const t = useT();
  const title =
    target === "calendar"
      ? t("calSync.errNoPermission")
      : target === "exact-alarm"
        ? t("notif.exactAlarmTitle")
        : t("notif.permissionDeniedTitle");
  const description =
    target === "calendar"
      ? t("calSync.permissionDeniedDesc")
      : target === "exact-alarm"
        ? t("notif.exactAlarmDesc")
        : t("notif.permissionDeniedDesc");

  return (
    <ConfirmSheet
      visible={target !== null}
      onClose={onClose}
      title={title}
      description={description}
      confirmText={t("notif.permissionDeniedOpenSettings")}
      cancelText={t("notif.permissionDeniedCancel")}
      onConfirm={() => {
        if (!target) return;
        const settingsTarget: PermissionSettingsTarget =
          target === "calendar" ? "application" : target;
        onClose();
        void openPermissionSettings(settingsTarget);
      }}
    />
  );
}
