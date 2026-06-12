import { Stack } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  Text,
  useWindowDimensions,
} from "react-native";
import Toast from "react-native-toast-message";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { MenuGroup, MenuItem } from "@/components/ui/menu-item";
import { BUILTIN_PALETTE_NAME_KEYS } from "@/constants/course-palettes";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";
import { useT } from "@/lib/i18n";
import {
  deleteAppCalendar,
  syncCoursesToCalendar,
} from "@/services/calendar-sync";
import { useCourseStore } from "@/store/course";
import { useScheduleStore } from "@/store/schedule";
import { useSettingsStore } from "@/store/settings";

function isCropCancelled(error: unknown) {
  const re = /cancell?ed/i;
  if (error && typeof error === "object" && "code" in error) {
    if (re.test(String((error as { code: unknown }).code))) return true;
  }
  if (error instanceof Error) return re.test(error.message);
  if (typeof error === "string") return re.test(error);
  return false;
}

export default function CalendarSettingsScreen() {
  useMarkRouteInteractive();
  const t = useT();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const iconColor = Colors[isDark ? "dark" : "light"].icon;

  const scrollWeekend = useScheduleStore((s) => s.scrollWeekend);
  const setScrollWeekend = useScheduleStore((s) => s.setScrollWeekend);
  const showMidday = useScheduleStore((s) => s.showMiddaySections);
  const setShowMidday = useScheduleStore((s) => s.setShowMiddaySections);
  const showOtherWeekCourses = useScheduleStore((s) => s.showOtherWeekCourses);
  const setShowOtherWeekCourses = useScheduleStore(
    (s) => s.setShowOtherWeekCourses,
  );
  const colorPalette = useScheduleStore((s) => s.colorPalette);
  const backgroundImageUri = useScheduleStore((s) => s.backgroundImageUri);
  const setBackgroundImageUri = useScheduleStore(
    (s) => s.setBackgroundImageUri,
  );

  const courses = useCourseStore((s) => s.courses);
  const calendarSync = useSettingsStore((s) => s.calendarSync);
  const setCalendarSync = useSettingsStore((s) => s.setCalendarSync);

  const [showBgPicker, setShowBgPicker] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const courseCount = useMemo(() => {
    const names = new Set(courses.map((c) => c.name));
    return names.size;
  }, [courses]);

  const handleCalendarSyncToggle = async (value: boolean) => {
    if (value) {
      setSyncing(true);
      const result = await syncCoursesToCalendar();
      setSyncing(false);
      if (result.success) {
        setCalendarSync(true);
        Toast.show({
          type: result.failed > 0 ? "info" : "success",
          text1: t("calendarSet.syncedToast"),
          text2:
            result.failed > 0
              ? t("calendarSet.syncedPartialSub", {
                  n: result.count,
                  m: result.failed,
                })
              : t("calendarSet.syncedSub", { n: result.count }),
          position: "bottom",
        });
      } else {
        Toast.show({
          type: "error",
          text1: t("calendarSet.syncFailed"),
          text2: result.error,
          position: "bottom",
        });
      }
    } else {
      await deleteAppCalendar();
      setCalendarSync(false);
      Toast.show({
        type: "success",
        text1: t("calendarSet.syncRemoved"),
        position: "bottom",
      });
    }
  };

  const deleteOldBg = async (uri: string | null) => {
    if (!uri) return;
    try {
      const { File } = await import("expo-file-system");
      const old = new File(uri);
      if (old.exists) old.delete();
    } catch {}
  };

  const handlePickImage = async () => {
    // 先关闭 BottomSheet，避免 expo-image-picker 在 RN Modal上下文
    // 调用 .launch() 触发 unregistered ActivityResultLauncher
    setShowBgPicker(false);
    let tempCroppedUri: string | null = null;
    try {
      const ImagePicker = await import("expo-image-picker");
      const { File, Paths } = await import("expo-file-system");
      const ExpoImageCropTool = (await import("@bsky.app/expo-image-crop-tool"))
        .default;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      const cropped = await ExpoImageCropTool.openCropperAsync({
        imageUri: asset.uri,
        shape: "rectangle",
        aspectRatio:
          windowWidth > 0 && windowHeight > 0
            ? windowWidth / windowHeight
            : undefined,
        format: "jpeg",
        compressImageQuality: 0.85,
        cancelButtonText: t("calendarSet.bgPickerCancel"),
        doneButtonText: t("calendarSet.bgPickerDone"),
      });

      tempCroppedUri = cropped.path;
      const source = new File(cropped.path);

      const dest = new File(Paths.document, `schedule-bg-${Date.now()}.jpg`);
      await source.copy(dest);
      await deleteOldBg(backgroundImageUri);

      setBackgroundImageUri(dest.uri);
      Toast.show({
        type: "success",
        text1: t("calendarSet.bgSetSuccess"),
        position: "bottom",
      });
    } catch (error) {
      if (isCropCancelled(error)) return;
      Toast.show({
        type: "error",
        text1: t("calendarSet.bgSetFailed"),
        text2: t("calendarSet.bgSetFailedSub"),
        position: "bottom",
      });
    } finally {
      if (tempCroppedUri) {
        try {
          const { File } = await import("expo-file-system");
          const temp = new File(tempCroppedUri);
          if (temp.exists) temp.delete();
        } catch {}
      }
    }
  };

  const handleRemoveBg = async () => {
    await deleteOldBg(backgroundImageUri);
    setBackgroundImageUri(null);
    setShowBgPicker(false);
    Toast.show({
      type: "success",
      text1: t("calendarSet.bgRemoved"),
      position: "bottom",
    });
  };

  const paletteKey = BUILTIN_PALETTE_NAME_KEYS[colorPalette.name];
  const paletteDisplayName = paletteKey ? t(paletteKey) : colorPalette.name;

  return (
    <>
      <Stack.Screen options={{ title: t("calendarSet.title") }} />
      <ScrollView
        className="flex-1 bg-neutral-100 dark:bg-neutral-900"
        contentContainerClassName="px-4 pt-4 pb-8"
      >
        <MenuGroup title={t("calendarSet.courseGroup")}>
          <MenuItem
            icon="school"
            iconBg="#34C759"
            label={t("calendarSet.courseManage")}
            value={
              courseCount > 0
                ? t("calendarSet.courseCount", { n: courseCount })
                : t("calendarSet.noCourses")
            }
            href="/settings/course/manage"
          />
        </MenuGroup>

        <MenuGroup title={t("calendarSet.displayGroup")}>
          <MenuItem
            icon="swap-horiz"
            iconBg="#007AFF"
            label={t("calendarSet.scrollWeekend")}
            showArrow={false}
            right={
              <Switch value={scrollWeekend} onValueChange={setScrollWeekend} />
            }
          />
          <MenuItem
            icon="wb-sunny"
            iconBg="#FF9500"
            label={t("calendarSet.showMidday")}
            showArrow={false}
            right={<Switch value={showMidday} onValueChange={setShowMidday} />}
          />
          <MenuItem
            icon="visibility"
            iconBg="#8E8E93"
            label={t("calendarSet.showOtherWeek")}
            showArrow={false}
            right={
              <Switch
                value={showOtherWeekCourses}
                onValueChange={setShowOtherWeekCourses}
              />
            }
          />
        </MenuGroup>

        <MenuGroup title={t("calendarSet.syncGroup")}>
          <MenuItem
            icon="event"
            iconBg="#FF9500"
            label={t("calendarSet.syncCalendar")}
            showArrow={false}
            right={
              syncing ? (
                <ActivityIndicator size="small" />
              ) : (
                <Switch
                  value={calendarSync}
                  onValueChange={handleCalendarSyncToggle}
                />
              )
            }
          />
        </MenuGroup>

        <MenuGroup title={t("calendarSet.customGroup")}>
          <MenuItem
            icon="palette"
            iconBg="#5856D6"
            label={t("calendarSet.palette")}
            value={paletteDisplayName}
            href="/settings/course/palette"
          />
          <MenuItem
            icon="tune"
            iconBg="#0EA5E9"
            label={t("calendarSet.visualStyle")}
            href="/settings/schedule-visual"
          />
          <MenuItem
            icon="image"
            iconBg="#FF2D55"
            label={t("calendarSet.bg")}
            value={
              backgroundImageUri
                ? t("calendarSet.bgSet")
                : t("calendarSet.bgNone")
            }
            onPress={() => setShowBgPicker(true)}
          />
        </MenuGroup>
      </ScrollView>

      <BottomSheet
        visible={showBgPicker}
        onClose={() => setShowBgPicker(false)}
        title={t("calendarSet.bgSheetTitle")}
      >
        <Pressable
          className="flex-row items-center px-5 py-3.5 active:bg-neutral-100 dark:active:bg-neutral-700"
          onPress={handlePickImage}
        >
          <IconSymbol name="photo-library" size={22} color={iconColor} />
          <Text className="ml-3 flex-1 text-base text-neutral-800 dark:text-neutral-200">
            {t("calendarSet.bgPickFromAlbum")}
          </Text>
        </Pressable>
        {backgroundImageUri && (
          <Pressable
            className="flex-row items-center px-5 py-3.5 active:bg-neutral-100 dark:active:bg-neutral-700"
            onPress={handleRemoveBg}
          >
            <IconSymbol name="delete-outline" size={22} color="#ef4444" />
            <Text className="ml-3 flex-1 text-base text-red-500">
              {t("calendarSet.bgRemove")}
            </Text>
          </Pressable>
        )}
      </BottomSheet>
    </>
  );
}
