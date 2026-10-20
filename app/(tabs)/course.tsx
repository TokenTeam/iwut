import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect, useIsFocused } from "expo-router";
import { Menu, X } from "lucide";
import {
  type ReactNode,
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SafeAreaView } from "react-native-screens/experimental";
import Toast from "react-native-toast-message";

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
import { LabImportSheet } from "@/components/layout/lab-import-sheet";
import { Schedule } from "@/components/layout/schedule";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { MorphingIcon } from "@/components/ui/morphing-icon";
import { ScrollPicker } from "@/components/ui/scroll-picker";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useHaptics } from "@/hooks/use-haptics";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";
import { MAX_WEEK } from "@/lib/course-weeks";
import { getCurrentDayOfWeek, getCurrentWeek, isVacation } from "@/lib/date";
import { useT } from "@/lib/i18n";
import { type ImportType, useCourseStore } from "@/store/course";
import { useScheduleStore } from "@/store/schedule";
import { getWarmupBottomInset, useStartupStore } from "@/store/startup";
import { useUserBindStore } from "@/store/user-bind";

function TabContent({
  children,
  bottomBackdrop,
  enabled,
}: {
  children: ReactNode;
  bottomBackdrop: ReactNode;
  enabled: boolean;
}) {
  const [layout, setLayout] = useState({
    width: 0,
    height: 0,
    contentHeight: 0,
    ready: false,
  });
  const viewport = useStartupStore((state) => state.viewport);
  const measuredBottomInset = Math.max(layout.height - layout.contentHeight, 0);
  const warmupBottomInset = getWarmupBottomInset(
    viewport,
    layout.width,
    layout.height,
  );
  // 隐藏页没有安全区时，复用同尺寸可见页的测量结果
  const bottomInset =
    layout.contentHeight > 0 && measuredBottomInset > 0
      ? measuredBottomInset
      : (warmupBottomInset ?? 0);
  const contentReady = layout.ready || warmupBottomInset !== null;

  const updateLayout = useCallback(
    (key: "width" | "height" | "contentHeight", value: number) => {
      setLayout((previous) => {
        if (previous[key] === value) return previous;
        const next = { ...previous, [key]: value };
        // 等底部安全区生效后再挂载，避免网格先铺满屏幕再缩短
        next.ready =
          previous.ready ||
          (Platform.OS === "ios" &&
            Platform.isPad &&
            next.contentHeight > 0 &&
            next.height > 0) ||
          (next.contentHeight > 0 && next.height > next.contentHeight);
        return next;
      });
    },
    [],
  );

  if (Platform.OS === "ios") {
    return (
      <View
        style={{ flex: 1 }}
        onLayout={(event) => {
          updateLayout("width", event.nativeEvent.layout.width);
          updateLayout("height", event.nativeEvent.layout.height);
        }}
      >
        <SafeAreaView
          pointerEvents="none"
          edges={{ bottom: true }}
          style={{ position: "absolute", inset: 0 }}
        >
          <View
            style={{ flex: 1 }}
            onLayout={(event) =>
              updateLayout("contentHeight", event.nativeEvent.layout.height)
            }
          />
        </SafeAreaView>
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: bottomInset,
          }}
        >
          {contentReady && enabled ? children : null}
        </View>
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: bottomInset,
          }}
        >
          {bottomBackdrop}
        </View>
      </View>
    );
  }

  return <View style={{ flex: 1 }}>{enabled ? children : null}</View>;
}

export default function CourseScreen() {
  const [scheduleReady, setScheduleReady] = useState(false);
  const handleScheduleReady = useCallback(() => {
    setScheduleReady(true);
    useStartupStore.getState().markCourseReady();
  }, []);
  useMarkRouteInteractive(scheduleReady);
  const isFocused = useIsFocused();
  const warmupRequested = useStartupStore((state) => state.tabsRequested);
  const [hasOpened, setHasOpened] = useState(isFocused);
  useFocusEffect(
    useCallback(() => {
      setHasOpened(true);
    }, []),
  );
  const t = useT();
  const courses = useCourseStore((store) => store.courses);
  const termStart = useCourseStore((store) => store.termStart);
  const isBound = useUserBindStore((store) => store.isBound);
  const hasBgImage = useScheduleStore((s) => !!s.backgroundImageUri);
  const currentWeek = getCurrentWeek(termStart);
  const [week, setWeek] = useState<number>(() => currentWeek);
  const today = getCurrentDayOfWeek();
  const haptic = useHaptics();
  const [showWeekPicker, setShowWeekPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showLabImport, setShowLabImport] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [pendingManualImport, setPendingManualImport] =
    useState<ImportType | null>(null);

  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const iconColor = Colors[isDark ? "dark" : "light"].icon;
  const insets = useSafeAreaInsets();

  const importerRef = useRef<GetCourseHandle>(null);

  useFocusEffect(
    useCallback(() => {
      return () => setShowDrawer(false);
    }, []),
  );

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
    haptic();
    setFabOpen(false);
    if (type === "lab") {
      setShowTypePicker(false);
      if (!isBound) {
        Toast.show({
          type: "info",
          text1: t("course.needBindTitle"),
          text2: t("course.needBindSub"),
          position: "bottom",
        });
        return;
      }
      // 实验课程只有日期，需要学期起始日换算周次
      if (!termStart) {
        Toast.show({
          type: "error",
          text1: t("course.labNeedBaseTimetable"),
          position: "bottom",
        });
        return;
      }
      setShowLabImport(true);
      return;
    }
    if (!isBound) {
      setPendingManualImport(type);
      setShowTypePicker(true);
      return;
    }
    setShowTypePicker(false);
    importerRef.current?.startImport(type);
  };

  const continueManualImport = () => {
    const type = pendingManualImport;
    setPendingManualImport(null);
    setShowTypePicker(false);
    if (type) importerRef.current?.startImport(type);
  };

  const changeWeek = (delta: number) => {
    const nextWeek = Math.max(1, Math.min(MAX_WEEK, week + delta));
    if (nextWeek === week) return;
    haptic();
    setWeek(nextWeek);
  };

  const goToWeek = (nextWeek: number) => {
    const clamped = Math.max(1, Math.min(MAX_WEEK, nextWeek));
    if (clamped === week) return;
    haptic();
    setWeek(clamped);
  };

  // 降低课表更新的优先级，避免快速选择周次时阻塞滚动
  const handleWeekPickerSelect = useCallback((index: number) => {
    startTransition(() => {
      setWeek(index + 1);
    });
  }, []);

  const handleReimport = () => {
    haptic();
    setShowTypePicker(true);
  };

  return (
    <TabContent
      enabled={isFocused || hasOpened || warmupRequested}
      bottomBackdrop={
        courses.length === 0 && (
          <Animated.View
            className="absolute inset-0 bg-black"
            style={fabOverlayStyle}
            pointerEvents="none"
          />
        )
      }
    >
      {hasBgImage && (
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
      )}
      <View style={{ flex: 1, paddingTop: insets.top }}>
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
            {/* 返回页面时重建图标，避免残留旧的绘制状态 */}
            {isFocused && (
              <MorphingIcon
                icon={showDrawer ? X : Menu}
                size={24}
                color={iconColor}
                strokeWidth={2}
              />
            )}
          </Pressable>

          <View className="flex-1 flex-row items-center justify-center">
            <Pressable
              className="w-10 items-center"
              style={{ opacity: week <= 1 ? 0 : 1 }}
              disabled={week <= 1}
              onPress={() => changeWeek(-1)}
            >
              <Ionicons name="chevron-back" size={20} color="gray" />
            </Pressable>

            <Pressable
              className="min-w-20 max-w-40 items-center"
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
              onPress={() => changeWeek(1)}
            >
              <Ionicons name="chevron-forward" size={20} color="gray" />
            </Pressable>
          </View>

          <Pressable
            className="min-w-12 max-w-20 items-center"
            style={{
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
          currentWeek={currentWeek}
          today={!isVacation(termStart) ? today : undefined}
          termStart={termStart}
          onWeekChange={goToWeek}
          onReady={handleScheduleReady}
        />

        {courses.length === 0 && (
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
                  onSelect={handleWeekPickerSelect}
                />
              </View>
            </View>
          </View>
        </Modal>
      </View>

      <GetCourse ref={importerRef} />

      <BottomSheet
        visible={showTypePicker}
        onClose={() => {
          setShowTypePicker(false);
          setPendingManualImport(null);
        }}
        title={
          pendingManualImport
            ? t("course.manualImportTitle")
            : t("course.selectImportType")
        }
      >
        {pendingManualImport ? (
          <>
            <Text className="px-5 pb-4 text-sm leading-5 text-neutral-500 dark:text-neutral-400">
              {t("course.manualImportDesc")}
            </Text>
            <View className="mx-5 mb-2 flex-row gap-3">
              <Pressable
                className="flex-1 items-center rounded-xl bg-neutral-200 py-3 active:bg-neutral-300 dark:bg-neutral-700 dark:active:bg-neutral-600"
                onPress={() => {
                  haptic();
                  setPendingManualImport(null);
                  setShowTypePicker(false);
                }}
              >
                <Text className="text-base font-medium text-neutral-600 dark:text-neutral-300">
                  {t("common.cancel")}
                </Text>
              </Pressable>
              <Pressable
                className="flex-1 items-center rounded-xl bg-blue-500 py-3 active:bg-blue-600"
                onPress={() => {
                  haptic();
                  continueManualImport();
                }}
              >
                <Text className="text-base font-medium text-white">
                  {t("course.manualImportContinue")}
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
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
            <Pressable
              className="flex-row items-center px-5 py-3.5 active:bg-neutral-100 dark:active:bg-neutral-700"
              onPress={() => doImport("lab")}
            >
              <IconSymbol name="science" size={22} color={iconColor} />
              <Text className="ml-3 flex-1 text-base text-neutral-800 dark:text-neutral-200">
                {t("course.lab")}
              </Text>
            </Pressable>
          </>
        )}
      </BottomSheet>

      <LabImportSheet
        visible={showLabImport}
        onClose={() => setShowLabImport(false)}
      />

      <CourseDrawer
        visible={showDrawer}
        onClose={() => setShowDrawer(false)}
        onManage={() => router.push("/(pages)/settings/course/manage")}
        onReimport={handleReimport}
        onOpenSettings={() => router.push("/(pages)/settings/calendar")}
      />
    </TabContent>
  );
}
