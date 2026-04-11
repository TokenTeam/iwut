import { Stack } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Switch, Text } from "react-native";
import Toast from "react-native-toast-message";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { MenuGroup, MenuItem } from "@/components/ui/menu-item";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useCourseStore } from "@/store/course";
import { useScheduleStore } from "@/store/schedule";

export default function CalendarSettingsScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const iconColor = Colors[isDark ? "dark" : "light"].icon;

  const scrollWeekend = useScheduleStore((s) => s.scrollWeekend);
  const setScrollWeekend = useScheduleStore((s) => s.setScrollWeekend);
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
      const { File } = await import("expo-file-system/next");
      const old = new File(uri);
      if (old.exists) old.delete();
    } catch {}
  };

  const handlePickImage = async () => {
    const ImagePicker = await import("expo-image-picker");
    const { File, Paths } = await import("expo-file-system/next");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (result.canceled) return;
    await deleteOldBg(backgroundImageUri);
    const source = new File(result.assets[0].uri);
    const dest = new File(Paths.document, `schedule-bg-${Date.now()}.jpg`);
    await source.copy(dest);
    setBackgroundImageUri(dest.uri);
    setShowBgPicker(false);
    Toast.show({ type: "success", text1: "背景已设置", position: "bottom" });
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
