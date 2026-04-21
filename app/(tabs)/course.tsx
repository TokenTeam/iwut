import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { Schedule } from "@/components/layout/schedule";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScrollPicker } from "@/components/ui/scroll-picker";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useHaptics } from "@/hooks/use-haptics";
import { getCurrentDayOfWeek, getCurrentWeek } from "@/lib/date";
import { GetCourse, type GetCourseHandle } from "@/services/get-course";
import { type ImportType, useCourseStore } from "@/store/course";
import { useScheduleStore } from "@/store/schedule";
import { useUserBindStore } from "@/store/user-bind";

const MAX_WEEK = 20;

export default function CourseScreen() {
  const courses = useCourseStore((store) => store.courses);
  const termStart = useCourseStore((store) => store.termStart);
  const lastImportType = useCourseStore((s) => s.lastImportType);
  const isBound = useUserBindStore((store) => store.isBound);
  const backgroundImageUri = useScheduleStore((s) => s.backgroundImageUri);
  const [week, setWeek] = useState<number>(() => getCurrentWeek(termStart));
  const today = getCurrentDayOfWeek();
  const haptic = useHaptics();
  const [showWeekPicker, setShowWeekPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);

  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const iconColor = Colors[isDark ? "dark" : "light"].icon;

  const importerRef = useRef<GetCourseHandle>(null);

  useEffect(() => {
    if (termStart) setWeek(getCurrentWeek(termStart));
  }, [termStart]);

  const [fabOpen, setFabOpen] = useState(false);
  const fabProgress = useSharedValue(0);

  useEffect(() => {
    fabProgress.value = withTiming(fabOpen ? 1 : 0, { duration: 200 });
  }, [fabOpen, fabProgress]);

  const bachelorFabStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(fabProgress.value, [0, 1], [0, -70]) },
    ],
    opacity: fabProgress.value,
  }));

  const masterFabStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(fabProgress.value, [0, 1], [0, -130]) },
    ],
    opacity: fabProgress.value,
  }));

  const fabButtonStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(fabProgress.value, [0, 1], [0, 45])}deg` },
    ],
  }));

  const fabOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(fabProgress.value, [0, 1], [0, 0.15]),
  }));

  const doImport = (type: ImportType) => {
    setShowTypePicker(false);
    setFabOpen(false);
    importerRef.current?.startImport(type);
  };

  const handleRefreshPress = () => {
    haptic();
    if (lastImportType) {
      doImport(lastImportType);
    } else {
      setShowTypePicker(true);
    }
  };

  const handleRefreshLongPress = () => {
    haptic();
    setShowTypePicker(true);
  };

  return (
    <View style={{ flex: 1 }}>
      {!!backgroundImageUri && (
        <Image
          source={{ uri: backgroundImageUri }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.25,
          }}
          contentFit="cover"
        />
      )}
      <SafeAreaView style={{ flex: 1 }}>
        <View className="h-12 w-full flex-row items-center px-3">
          {isBound && courses.some((c) => c.source === "imported") ? (
            <Pressable
              style={{ width: 48, alignItems: "center" }}
              onPress={handleRefreshPress}
              onLongPress={handleRefreshLongPress}
            >
              <Ionicons name="refresh" size={20} color={iconColor} />
            </Pressable>
          ) : (
            <View style={{ width: 48 }} />
          )}

          <View className="flex-1 flex-row items-center justify-center">
            <Pressable
              className="w-10 items-center"
              style={{ opacity: week <= 1 ? 0 : 1 }}
              disabled={week <= 1}
              onPress={() => {
                haptic();
                setWeek((w) => w - 1);
              }}
            >
              <Ionicons name="chevron-back" size={20} color="gray" />
            </Pressable>

            <Pressable
              className="w-20 items-center"
              onPress={() => setShowWeekPicker(true)}
            >
              <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                第 {week} 周
              </Text>
            </Pressable>

            <Pressable
              className="w-10 items-center"
              style={{ opacity: week >= MAX_WEEK ? 0 : 1 }}
              disabled={week >= MAX_WEEK}
              onPress={() => {
                haptic();
                setWeek((w) => w + 1);
              }}
            >
              <Ionicons name="chevron-forward" size={20} color="gray" />
            </Pressable>
          </View>

          <Pressable
            style={{
              width: 48,
              alignItems: "center",
              opacity: week !== getCurrentWeek(termStart) ? 1 : 0,
            }}
            disabled={week === getCurrentWeek(termStart)}
            onPress={() => {
              haptic();
              setWeek(getCurrentWeek(termStart));
            }}
          >
            <Ionicons name="today-outline" size={18} color="#3b82f6" />
            <Text
              style={{
                fontSize: 9,
                color: "#3b82f6",
                fontWeight: "500",
                marginTop: 1,
              }}
            >
              {`${new Date().getMonth() + 1}月${new Date().getDate()}日`}
            </Text>
          </Pressable>
        </View>

        <Schedule
          courses={courses}
          week={week}
          today={week === getCurrentWeek(termStart) ? today : undefined}
          termStart={termStart}
        />

        {isBound && courses.length === 0 && (
          <>
            <Animated.View
              className="absolute inset-0 bg-black"
              style={fabOverlayStyle}
              pointerEvents={fabOpen ? "auto" : "none"}
            >
              <Pressable className="flex-1" onPress={() => setFabOpen(false)} />
            </Animated.View>

            <Animated.View
              className="absolute bottom-14 right-9 flex-row items-center"
              style={masterFabStyle}
              pointerEvents={fabOpen ? "auto" : "none"}
            >
              <View className="mr-3 rounded-lg bg-white px-3 py-1.5 dark:bg-neutral-700">
                <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                  研究生
                </Text>
              </View>
              <Pressable
                className="h-14 w-14 items-center justify-center rounded-full bg-purple-500"
                onPress={() => doImport("master")}
              >
                <Ionicons name="library" size={22} color="white" />
              </Pressable>
            </Animated.View>

            <Animated.View
              className="absolute bottom-14 right-9 flex-row items-center"
              style={bachelorFabStyle}
              pointerEvents={fabOpen ? "auto" : "none"}
            >
              <View className="mr-3 rounded-lg bg-white px-3 py-1.5 dark:bg-neutral-700">
                <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                  本科生
                </Text>
              </View>
              <Pressable
                className="h-14 w-14 items-center justify-center rounded-full bg-green-500"
                onPress={() => doImport("bachelor")}
              >
                <Ionicons name="school" size={22} color="white" />
              </Pressable>
            </Animated.View>

            <Pressable
              className="absolute bottom-12 right-8 h-16 w-16 items-center justify-center rounded-full bg-blue-500"
              onPress={() => setFabOpen((v) => !v)}
            >
              <Animated.View style={fabButtonStyle}>
                <Ionicons name="add" size={32} color="white" />
              </Animated.View>
            </Pressable>
          </>
        )}

        <Modal
          visible={showWeekPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowWeekPicker(false)}
        >
          <View className="flex-1 justify-end">
            <Pressable
              className="absolute inset-0"
              onPress={() => setShowWeekPicker(false)}
            >
              <LinearGradient
                colors={["rgba(0,0,0,0.03)", "rgba(0,0,0,0.1)"]}
                className="flex-1"
              />
            </Pressable>
            <View className="rounded-t-2xl overflow-hidden">
              <View className="bg-white pb-8 pt-5 dark:bg-neutral-800">
                <ScrollPicker
                  items={Array.from(
                    { length: MAX_WEEK },
                    (_, i) => `第 ${i + 1} 周`,
                  )}
                  selectedIndex={week - 1}
                  onSelect={(i) => setWeek(i + 1)}
                />
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>

      <GetCourse ref={importerRef} />

      <BottomSheet
        visible={showTypePicker}
        onClose={() => setShowTypePicker(false)}
        title="选择导入类型"
      >
        <Pressable
          className="flex-row items-center px-5 py-3.5 active:bg-neutral-100 dark:active:bg-neutral-700"
          onPress={() => doImport("bachelor")}
        >
          <IconSymbol name="school" size={22} color={iconColor} />
          <Text className="ml-3 flex-1 text-base text-neutral-800 dark:text-neutral-200">
            本科生
          </Text>
        </Pressable>
        <Pressable
          className="flex-row items-center px-5 py-3.5 active:bg-neutral-100 dark:active:bg-neutral-700"
          onPress={() => doImport("master")}
        >
          <IconSymbol name="menu-book" size={22} color={iconColor} />
          <Text className="ml-3 flex-1 text-base text-neutral-800 dark:text-neutral-200">
            研究生
          </Text>
        </Pressable>
      </BottomSheet>
    </View>
  );
}
