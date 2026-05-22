import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { Directory, File, Paths } from "expo-file-system";
import { Image } from "expo-image";
import { Stack } from "expo-router";
import * as Sharing from "expo-sharing";
import JSZip from "jszip";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { FileLogger } from "react-native-file-logger";
import Toast from "react-native-toast-message";
import { WebView } from "react-native-webview";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { MenuGroup, MenuItem } from "@/components/ui/menu-item";
import { useT } from "@/lib/i18n";
import { reportError } from "@/lib/report";
import {
  registerBackgroundRefresh,
  scheduleWeeklyReminders,
  unregisterBackgroundRefresh,
} from "@/services/course-notification";
import { useScheduleStore } from "@/store/schedule";
import { useSettingsStore } from "@/store/settings";

const REMINDER_PRESETS = [15, 30, 60];

export default function SettingsScreen() {
  const t = useT();
  const hapticFeedback = useSettingsStore((s) => s.hapticFeedback);
  const setHapticFeedback = useSettingsStore((s) => s.setHapticFeedback);
  const openCourseOnLaunch = useSettingsStore((s) => s.openCourseOnLaunch);
  const setOpenCourseOnLaunch = useSettingsStore(
    (s) => s.setOpenCourseOnLaunch,
  );
  const courseReminder = useSettingsStore((s) => s.courseReminder);
  const setCourseReminder = useSettingsStore((s) => s.setCourseReminder);
  const reminderMinutes = useSettingsStore((s) => s.reminderMinutes);
  const setReminderMinutes = useSettingsStore((s) => s.setReminderMinutes);

  const [clearVisible, setClearVisible] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [reminderSheetVisible, setReminderSheetVisible] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");
  const customInputRef = useRef<TextInput>(null);

  // 临时挂载隐藏 WebView 调 ref.clearCache(true)
  const [cacheWebViewMounted, setCacheWebViewMounted] = useState(false);
  const cacheClearedResolveRef = useRef<(() => void) | null>(null);

  const clearWebViewCache = () =>
    new Promise<void>((resolve) => {
      // ref 回调没拿到实例也要在 2s 后放行避免卡死
      const timer = setTimeout(() => {
        cacheClearedResolveRef.current = null;
        setCacheWebViewMounted(false);
        resolve();
      }, 2000);

      cacheClearedResolveRef.current = () => {
        clearTimeout(timer);
        resolve();
      };
      setCacheWebViewMounted(true);
    });

  const handleCacheWebViewRef = (instance: WebView | null) => {
    if (!instance) return;
    // ref 已赋值意味着 native 视图构造完成，再给 50ms 缓冲后派发命令
    setTimeout(() => {
      instance.clearCache(true);
      setTimeout(() => {
        setCacheWebViewMounted(false);
        cacheClearedResolveRef.current?.();
        cacheClearedResolveRef.current = null;
      }, 100);
    }, 50);
  };

  const handleCourseReminderChange = async (value: boolean) => {
    // 检查通知权限
    if (value && Platform.OS === "android") {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) return;
    }

    setCourseReminder(value);
    await scheduleWeeklyReminders();
    if (value) {
      await registerBackgroundRefresh();
    } else {
      await unregisterBackgroundRefresh();
    }
  };

  const handleReminderMinutesChange = async (value: number) => {
    if (value < 1 || value > 120) return;
    setReminderMinutes(value);
    setCustomMinutes("");
    setReminderSheetVisible(false);
    if (courseReminder) {
      await scheduleWeeklyReminders();
    }
  };

  const handleCustomMinutesSubmit = () => {
    const val = parseInt(customMinutes, 10);
    if (!val || val < 1 || val > 120) {
      Toast.show({
        type: "error",
        text1: t("settings.reminderRangeError"),
        position: "bottom",
      });
      return;
    }
    handleReminderMinutesChange(val);
  };

  const handleClearCache = async () => {
    setClearVisible(false);
    setClearing(true);
    try {
      await FileLogger.deleteLogFiles();
      await Image.clearDiskCache();
      await clearWebViewCache();

      const docDir = new Directory(Paths.document);
      const currentBgUri = useScheduleStore.getState().backgroundImageUri;
      for (const entry of docDir.listAsRecords()) {
        if (
          !entry.isDirectory &&
          entry.uri.includes("schedule-bg-") &&
          entry.uri.endsWith(".jpg")
        ) {
          const file = new File(entry.uri);
          if (file.uri !== currentBgUri) {
            file.delete();
          }
        }
      }

      const { createMMKV } = await import("react-native-mmkv");
      createMMKV({ id: "rpc_apps" }).clearAll();

      Toast.show({
        type: "success",
        text1: t("settings.cacheCleared"),
        position: "bottom",
      });
    } catch (e) {
      reportError(e, { module: "settings", action: "clear-cache" });
      Toast.show({
        type: "error",
        text1: t("settings.clearCacheFailed"),
        position: "bottom",
      });
    } finally {
      setClearing(false);
    }
  };

  const handleExportLogs = async () => {
    setExporting(true);

    try {
      const paths = await FileLogger.getLogFilePaths();

      if (paths.length === 0) {
        Toast.show({
          type: "info",
          text1: t("settings.exportNoLog"),
          position: "bottom",
        });
        return;
      }

      const version = Constants.expoConfig?.version;
      const commit = Constants.expoConfig?.extra?.commit;

      const info = [
        `Version: ${version}, Commit: ${commit}`,
        `Device: ${Device.manufacturer} ${Device.modelName} ${Device.modelId}`,
        `OS: ${Device.osName} ${Device.osVersion} ${Device.osBuildId} ${Device.osInternalBuildId} ${Device.osBuildFingerprint}`,
        `Architecture: ${Device.supportedCpuArchitectures}`,
        `Memory: ${Device.totalMemory}`,
        `Time: ${new Date().toISOString()}`,
      ].join("\n");

      const archive = new JSZip();
      archive.file("info.txt", info);

      for (const p of paths) {
        const uri = p.startsWith("file://") ? p : `file://${p}`;
        const src = new File(uri);
        if (src.exists) {
          const content = await src.text();
          archive.file(src.name, content);
        }
      }

      const zipData = await archive.generateAsync({ type: "uint8array" });
      const zipName = `dev.tokenteam.net_logs_${Date.now()}.zip`;
      const zipFile = new File(Paths.cache, zipName);
      await zipFile.write(zipData);

      await Sharing.shareAsync(zipFile.uri, {
        UTI: "public.zip-archive",
        mimeType: "application/zip",
        dialogTitle: t("settings.exportDialogTitle"),
      });
    } catch (e) {
      reportError(e, { module: "settings", action: "export-logs" });
      Toast.show({
        type: "error",
        text1: t("settings.exportFailed"),
        position: "bottom",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t("settings.generalTitle") }} />
      <ScrollView
        className="flex-1 bg-neutral-100 dark:bg-neutral-900"
        contentContainerClassName="px-4 pt-4"
      >
        <MenuGroup title={t("settings.interaction")}>
          <MenuItem
            icon="vibration"
            iconBg="#AF52DE"
            label={t("settings.haptic")}
            showArrow={false}
            right={
              <Switch
                value={hapticFeedback}
                onValueChange={setHapticFeedback}
              />
            }
          />
          <MenuItem
            icon="open-in-new"
            iconBg="#34C759"
            label={t("settings.openCourseOnLaunch")}
            showArrow={false}
            right={
              <Switch
                value={openCourseOnLaunch}
                onValueChange={setOpenCourseOnLaunch}
              />
            }
          />
        </MenuGroup>

        <MenuGroup title={t("settings.notification")}>
          <MenuItem
            icon="notifications-active"
            iconBg="#FF9500"
            label={t("settings.courseReminder")}
            showArrow={false}
            right={
              <Switch
                value={courseReminder}
                onValueChange={handleCourseReminderChange}
              />
            }
          />
          {courseReminder && (
            <MenuItem
              icon="schedule"
              iconBg="#5856D6"
              label={t("settings.reminderTime")}
              showArrow
              right={
                <Text className="text-sm text-neutral-500">
                  {t("settings.reminderTimeMins", { n: reminderMinutes })}
                </Text>
              }
              onPress={() => setReminderSheetVisible(true)}
            />
          )}
        </MenuGroup>

        <MenuGroup title={t("settings.storage")}>
          <MenuItem
            icon="delete-outline"
            iconBg="#FF3B30"
            label={t("settings.clearCache")}
            showArrow={false}
            right={clearing ? <ActivityIndicator size="small" /> : undefined}
            onPress={() => setClearVisible(true)}
          />
          <MenuItem
            icon="description"
            iconBg="#007AFF"
            label={t("settings.exportLogs")}
            showArrow={false}
            right={exporting ? <ActivityIndicator size="small" /> : undefined}
            onPress={handleExportLogs}
          />
        </MenuGroup>
      </ScrollView>

      <ConfirmSheet
        visible={clearVisible}
        onClose={() => setClearVisible(false)}
        title={t("settings.clearCacheTitle")}
        description={t("settings.clearCacheDesc")}
        confirmText={t("settings.clearCacheConfirm")}
        destructive
        onConfirm={handleClearCache}
      />

      <BottomSheet
        visible={reminderSheetVisible}
        onClose={() => setReminderSheetVisible(false)}
        title={t("settings.reminderTime")}
      >
        {REMINDER_PRESETS.map((mins) => (
          <MenuItem
            key={mins}
            icon={reminderMinutes === mins ? "check" : "radio-button-unchecked"}
            iconBg={reminderMinutes === mins ? "#34C759" : "#C7C7CC"}
            label={t("settings.reminderTimeMins", { n: mins })}
            showArrow={false}
            onPress={() => handleReminderMinutesChange(mins)}
          />
        ))}
        <View className="flex-row items-center px-4 py-3">
          <Text className="text-base text-neutral-900 dark:text-neutral-100">
            {t("settings.custom")}
          </Text>
          <TextInput
            ref={customInputRef}
            style={{
              marginHorizontal: 12,
              height: 34,
              flex: 1,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: "#D4D4D4",
              paddingHorizontal: 12,
              paddingVertical: 0,
              textAlign: "center",
              fontSize: 14,
            }}
            keyboardType="number-pad"
            maxLength={3}
            placeholder={t("settings.customPlaceholder")}
            placeholderTextColor="#9CA3AF"
            value={customMinutes}
            onChangeText={setCustomMinutes}
            onSubmitEditing={handleCustomMinutesSubmit}
            returnKeyType="done"
          />
          <Text className="text-base text-neutral-500">
            {t("common.minutes")}
          </Text>
          <Pressable
            style={{
              marginLeft: 8,
              height: 34,
              width: 34,
              borderRadius: 8,
              backgroundColor: "#3b82f6",
              alignItems: "center",
              justifyContent: "center",
            }}
            onPress={handleCustomMinutesSubmit}
          >
            <MaterialIcons name="check" size={20} color="white" />
          </Pressable>
        </View>
      </BottomSheet>

      {cacheWebViewMounted && (
        <View
          style={{
            position: "absolute",
            left: -9999,
            top: 0,
            width: 390,
            height: 844,
          }}
          pointerEvents="none"
        >
          <WebView
            ref={handleCacheWebViewRef}
            source={{ uri: "about:blank" }}
          />
        </View>
      )}
    </>
  );
}
