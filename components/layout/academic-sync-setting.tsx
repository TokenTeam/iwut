import { Host, Switch as NativeSwitch } from "@expo/ui";
import { useMemo, useState } from "react";
import Toast from "react-native-toast-message";

import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { MenuItem } from "@/components/ui/menu-item";
import { useT } from "@/lib/i18n";
import { useCourseStore } from "@/store/course";
import { useSettingsStore } from "@/store/settings";
import { useUserBindStore } from "@/store/user-bind";

export function AcademicSyncSetting({
  showLastSync = false,
}: Readonly<{ showLastSync?: boolean }>) {
  const t = useT();
  const enabled = useSettingsStore((s) => s.autoRefreshCourses);
  const setEnabled = useSettingsStore((s) => s.setAutoRefreshCourses);
  const lastSyncAt = useCourseStore((s) => s.lastAutoRefreshSuccessAt);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const lastSyncDate = useMemo(
    () =>
      showLastSync && lastSyncAt !== null && Number.isFinite(lastSyncAt)
        ? new Intl.DateTimeFormat("zh-CN", {
            timeZone: "Asia/Shanghai",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
          }).format(lastSyncAt)
        : null,
    [showLastSync, lastSyncAt],
  );

  const handleChange = (value: boolean, conflictConfirmed = false) => {
    const user = useUserBindStore.getState();
    if (value && !user.isBound) {
      Toast.show({
        type: "info",
        text1: t("course.needBindTitle"),
        text2: t("course.needBindSub"),
        position: "bottom",
      });
      return;
    }
    const { importOrigin, courses } = useCourseStore.getState();
    if (value && importOrigin?.studentId !== user.studentId) {
      Toast.show({
        type: "info",
        text1: t("calendarSet.autoRefreshNeedsImport"),
        position: "bottom",
      });
      return;
    }
    if (
      value &&
      !conflictConfirmed &&
      courses.some((course) => course.source === "manual")
    ) {
      setConfirmVisible(true);
      return;
    }
    setEnabled(value);
  };

  return (
    <>
      <MenuItem
        icon="sync"
        iconBg="#178f8b"
        label={t("calendarSet.academicSync")}
        value={
          showLastSync && enabled
            ? (lastSyncDate ?? t("calendarSet.neverSynced"))
            : undefined
        }
        onPress={() =>
          handleChange(!useSettingsStore.getState().autoRefreshCourses)
        }
        showArrow={false}
        right={
          <Host matchContents style={{ minWidth: 52, minHeight: 32 }}>
            <NativeSwitch
              value={enabled}
              onValueChange={handleChange}
              testID="auto-refresh-courses"
            />
          </Host>
        }
      />
      <ConfirmSheet
        visible={confirmVisible}
        onClose={() => setConfirmVisible(false)}
        title={t("calendarSet.academicSync")}
        description={t("calendarSet.autoRefreshConflictWarning")}
        onConfirm={() => {
          setConfirmVisible(false);
          handleChange(true, true);
        }}
      />
    </>
  );
}
