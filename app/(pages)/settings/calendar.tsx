import { Stack } from "expo-router";
import { useMemo, useState } from "react";
import {
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
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useCourseStore } from "@/store/course";
import { useScheduleStore } from "@/store/schedule";

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
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const iconColor = Colors[isDark ? "dark" : "light"].icon;

  const scrollWeekend = useScheduleStore((s) => s.scrollWeekend);
  const setScrollWeekend = useScheduleStore((s) => s.setScrollWeekend);
  const showMidday = useScheduleStore((s) => s.showMiddaySections);
  const setShowMidday = useScheduleStore((s) => s.setShowMiddaySections);
  const colorPalette = useScheduleStore((s) => s.colorPalette);
  const backgroundImageUri = useScheduleStore((s) => s.backgroundImageUri);
  const setBackgroundImageUri = useScheduleStore(
    (s) => s.setBackgroundImageUri,
  );

  const courses = useCourseStore((s) => s.courses);

  const [showBgPicker, setShowBgPicker] = useState(false);

  const courseCount = useMemo(() => {
    const names = new Set(courses.map((c) => c.name));
    return names.size;
  }, [courses]);

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
      const ExpoImageCropTool = (
        await import("@bsky.app/expo-image-crop-tool")
      ).default;

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
        cancelButtonText: "取消",
        doneButtonText: "完成",
      });

      tempCroppedUri = cropped.path;
      const source = new File(cropped.path);

      const dest = new File(Paths.document, `schedule-bg-${Date.now()}.jpg`);
      await source.copy(dest);
      await deleteOldBg(backgroundImageUri);

      setBackgroundImageUri(dest.uri);
      Toast.show({
        type: "success",
        text1: "背景已设置",
        position: "bottom",
      });
    } catch (error) {
      if (isCropCancelled(error)) return;
      Toast.show({
        type: "error",
        text1: "背景设置失败",
        text2: "图片裁剪或保存时出现问题",
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
    Toast.show({ type: "success", text1: "背景已移除", position: "bottom" });
  };

  return (
    <>
      <Stack.Screen options={{ title: "课表设置" }} />
      <ScrollView
        className="flex-1 bg-neutral-100 dark:bg-neutral-900"
        contentContainerClassName="px-4 pt-4 pb-8"
      >
        <MenuGroup title="课程">
          <MenuItem
            icon="school"
            iconBg="#34C759"
            label="课程管理"
            value={courseCount > 0 ? `${courseCount} 门课` : "暂无课程"}
            href="/settings/course/manage"
          />
        </MenuGroup>

        <MenuGroup title="显示">
          <MenuItem
            icon="swap-horiz"
            iconBg="#007AFF"
            label="周末课表滚动查看"
            showArrow={false}
            right={
              <Switch value={scrollWeekend} onValueChange={setScrollWeekend} />
            }
          />
          <MenuItem
            icon="wb-sunny"
            iconBg="#FF9500"
            label="显示中课"
            showArrow={false}
            right={<Switch value={showMidday} onValueChange={setShowMidday} />}
          />
        </MenuGroup>

        <MenuGroup title="个性化">
          <MenuItem
            icon="palette"
            iconBg="#5856D6"
            label="配色方案"
            value={colorPalette.name}
            href="/settings/course/palette"
          />
          <MenuItem
            icon="image"
            iconBg="#FF2D55"
            label="课表背景"
            value={backgroundImageUri ? "已设置" : "无"}
            onPress={() => setShowBgPicker(true)}
          />
        </MenuGroup>
      </ScrollView>

      <BottomSheet
        visible={showBgPicker}
        onClose={() => setShowBgPicker(false)}
        title="课表背景"
      >
        <Pressable
          className="flex-row items-center px-5 py-3.5 active:bg-neutral-100 dark:active:bg-neutral-700"
          onPress={handlePickImage}
        >
          <IconSymbol name="photo-library" size={22} color={iconColor} />
          <Text className="ml-3 flex-1 text-base text-neutral-800 dark:text-neutral-200">
            从相册选择
          </Text>
        </Pressable>
        {backgroundImageUri && (
          <Pressable
            className="flex-row items-center px-5 py-3.5 active:bg-neutral-100 dark:active:bg-neutral-700"
            onPress={handleRemoveBg}
          >
            <IconSymbol name="delete-outline" size={22} color="#ef4444" />
            <Text className="ml-3 flex-1 text-base text-red-500">移除背景</Text>
          </Pressable>
        )}
      </BottomSheet>
    </>
  );
}
