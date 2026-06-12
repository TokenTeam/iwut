import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
  COURSE_HEADER_HEIGHT,
  CourseDrawer,
  DRAWER_ENTER_MS,
  DRAWER_EXIT_MS,
} from "@/components/layout/course-drawer";
import {
  GetCourse,
  type GetCourseHandle,
} from "@/components/layout/course-importer";
import { Schedule } from "@/components/layout/schedule";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScrollPicker } from "@/components/ui/scroll-picker";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useHaptics } from "@/hooks/use-haptics";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";
import { MAX_WEEK } from "@/lib/course-weeks";
import { getCurrentDayOfWeek, getCurrentWeek } from "@/lib/date";
import { useT } from "@/lib/i18n";
import { type ImportType, useCourseStore } from "@/store/course";
import { useScheduleStore } from "@/store/schedule";
import { useUserBindStore } from "@/store/user-bind";

export default function CourseScreen() {
  useMarkRouteInteractive();
  const t = useT();
  const courses = useCourseStore((store) => store.courses);
  const termStart = useCourseStore((store) => store.termStart);
  const isBound = useUserBindStore((store) => store.isBound);
  const backgroundImageUri = useScheduleStore((s) => s.backgroundImageUri);
  const backgroundImageOpacity = useScheduleStore(
    (s) => s.backgroundImageOpacity,
  );
  const backgroundImageBlurRadius = useScheduleStore(
    (s) => s.backgroundImageBlurRadius,
  );
  const [week, setWeek] = useState<number>(() => getCurrentWeek(termStart));
  const today = getCurrentDayOfWeek();
  const haptic = useHaptics();
  const [showWeekPicker, setShowWeekPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const iconColor = Colors[isDark ? "dark" : "light"].icon;
  const insets = useSafeAreaInsets();

  const importerRef = useRef<GetCourseHandle>(null);

  const [prevTermStart, setPrevTermStart] = useState(termStart);
  if (termStart !== prevTermStart) {
    setPrevTermStart(termStart);
    if (termStart) setWeek(getCurrentWeek(termStart));
  }

  const [fabOpen, setFabOpen] = useState(false);
  const fabProgress = useSharedValue(0);

  useEffect(() => {
    fabProgress.value = withTiming(fabOpen ? 1 : 0, { duration: 200 });
  }, [fabOpen, fabProgress]);

  // 侧栏展开时顶栏垫上实色背景，避免背景图穿透；动画节奏与抽屉保持一致
  const headerBackdropProgress = useSharedValue(0);

  useEffect(() => {
    headerBackdropProgress.value = withTiming(showDrawer ? 1 : 0, {
      duration: showDrawer ? DRAWER_ENTER_MS : DRAWER_EXIT_MS,
      easing: showDrawer ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
    });
  }, [showDrawer, headerBackdropProgress]);

  const headerBackdropStyle = useAnimatedStyle(() => ({
    opacity: headerBackdropProgress.value,
  }));

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

  const handleReimport = () => {
    haptic();
    setShowTypePicker(true);
  };

  return (
    <View style={{ flex: 1 }}>
      {!!backgroundImageUri && (
        <>
          <Image
            source={{ uri: backgroundImageUri }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: backgroundImageOpacity,
            }}
            contentFit="cover"
            blurRadius={backgroundImageBlurRadius}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: insets.top + COURSE_HEADER_HEIGHT,
                backgroundColor: Colors[isDark ? "dark" : "light"].background,
              },
              headerBackdropStyle,
            ]}
          />
        </>
      )}
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <View
          className="w-full flex-row items-center px-3"
          style={{ height: COURSE_HEADER_HEIGHT }}
        >
          <Pressable
            style={{ width: 48, alignItems: "center" }}
            onPress={() => {
              haptic();
              setShowDrawer((visible) => !visible);
            }}
          >
            <Ionicons name="menu-outline" size={24} color={iconColor} />
          </Pressable>

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
                {t("common.weekN", { n: week })}
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
              {t("common.monthDay", {
                m: new Date().getMonth() + 1,
                d: new Date().getDate(),
              })}
            </Text>
          </Pressable>
        </View>

        <Schedule
          courses={courses}
          week={week}
          today={week === getCurrentWeek(termStart) ? today : undefined}
          termStart={termStart}
        />

        {!isBound && (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: isDark
                ? "rgba(0,0,0,0.65)"
                : "rgba(255,255,255,0.75)",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(0,0,0,0.04)",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons
                name="person-circle-outline"
                size={26}
                color={isDark ? "#525252" : "#a3a3a3"}
              />
            </View>
            <Text
              style={{
                fontSize: 15,
                fontWeight: "600",
                color: isDark ? "#a3a3a3" : "#737373",
              }}
            >
              {t("course.needBindTitle")}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: isDark ? "#525252" : "#a3a3a3",
                textAlign: "center",
                paddingHorizontal: 40,
                lineHeight: 20,
              }}
            >
              {t("course.needBindSub")}
            </Text>
            <Pressable
              style={({ pressed }) => ({
                marginTop: 4,
                flexDirection: "row",
                alignItems: "center",
                gap: 2,
                opacity: pressed ? 0.5 : 1,
              })}
              onPress={() => {
                haptic();
                router.navigate("/(tabs)/user");
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: "#3b82f6",
                  fontWeight: "500",
                }}
              >
                {t("course.goBind")}
              </Text>
              <Ionicons name="chevron-forward" size={13} color="#3b82f6" />
            </Pressable>
          </View>
        )}

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
                  {t("course.master")}
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
                  {t("course.bachelor")}
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
                  items={Array.from({ length: MAX_WEEK }, (_, i) =>
                    t("common.weekN", { n: i + 1 }),
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
        title={t("course.selectImportType")}
      >
        <Pressable
          className="flex-row items-center px-5 py-3.5 active:bg-neutral-100 dark:active:bg-neutral-700"
          onPress={() => doImport("bachelor")}
        >
          <IconSymbol name="school" size={22} color={iconColor} />
          <Text className="ml-3 flex-1 text-base text-neutral-800 dark:text-neutral-200">
            {t("course.bachelor")}
          </Text>
        </Pressable>
        <Pressable
          className="flex-row items-center px-5 py-3.5 active:bg-neutral-100 dark:active:bg-neutral-700"
          onPress={() => doImport("master")}
        >
          <IconSymbol name="menu-book" size={22} color={iconColor} />
          <Text className="ml-3 flex-1 text-base text-neutral-800 dark:text-neutral-200">
            {t("course.master")}
          </Text>
        </Pressable>
      </BottomSheet>

      <CourseDrawer
        visible={showDrawer}
        onClose={() => setShowDrawer(false)}
        isBound={isBound}
        onManage={() => router.push("/(pages)/settings/course/manage")}
        onReimport={handleReimport}
        onOpenSettings={() => router.push("/(pages)/settings/calendar")}
      />
    </View>
  );
}
