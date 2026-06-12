import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { CourseDetailModal } from "@/components/layout/course-detail-modal";
import { TabBackground } from "@/components/layout/tab-background";
import { AnnouncementBanner } from "@/components/ui/announcement-banner";
import { getDayLabels } from "@/constants/weekdays";
import { buildColorMap, getCourseColor } from "@/lib/course-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useHaptics } from "@/hooks/use-haptics";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";
import { useMinuteNow } from "@/hooks/use-minute-now";
import {
  getCurrentDayOfWeek,
  getCurrentWeek,
  getTomorrowDayOfWeek,
  getTomorrowWeek,
  isVacation,
} from "@/lib/date";
import { type TKey, useT } from "@/lib/i18n";
import { filterActiveAnnouncements } from "@/services/announcements";
import {
  formatCourseSectionTimeRange,
  SECTION_TIMES,
} from "@/services/course-time";
import { useAnnouncementStore } from "@/store/announcements";
import type { Course } from "@/store/course";
import { useCourseStore } from "@/store/course";
import { useScheduleStore } from "@/store/schedule";
import { useUpdateStore } from "@/store/update";

type GreetingSlot = {
  start: number;
  end: number;
  titleKey: TKey;
  subKey: TKey;
};

const GREETING_SLOTS: GreetingSlot[] = [
  {
    start: 5,
    end: 8,
    titleKey: "home.greetEarlyMorning",
    subKey: "home.greetEarlyMorningSub",
  },
  {
    start: 8,
    end: 11,
    titleKey: "home.greetMorning",
    subKey: "home.greetMorningSub",
  },
  {
    start: 11,
    end: 13,
    titleKey: "home.greetNoon",
    subKey: "home.greetNoonSub",
  },
  {
    start: 13,
    end: 17,
    titleKey: "home.greetAfternoon",
    subKey: "home.greetAfternoonSub",
  },
  {
    start: 17,
    end: 19,
    titleKey: "home.greetEvening",
    subKey: "home.greetEveningSub",
  },
  {
    start: 19,
    end: 23,
    titleKey: "home.greetNight",
    subKey: "home.greetNightSub",
  },
  {
    start: 23,
    end: 5,
    titleKey: "home.greetLateNight",
    subKey: "home.greetLateNightSub",
  },
];

const CARD_GAP = 10;

type Countdown = { kind: "start" | "end"; mins: number };

function isCourseFinished(course: Course, nowMs: number): boolean {
  const now = new Date(nowMs);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin > (SECTION_TIMES[course.sectionEnd]?.[3] ?? 0);
}

function getCourseCountdown(course: Course, nowMs: number): Countdown | null {
  const now = new Date(nowMs);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = SECTION_TIMES[course.sectionStart]?.[2] ?? 0;
  const endMin = SECTION_TIMES[course.sectionEnd]?.[3] ?? 0;

  if (nowMin > endMin) return null;
  if (nowMin < startMin) {
    const diff = startMin - nowMin;
    return diff <= 60 ? { kind: "start", mins: diff } : null;
  }
  return { kind: "end", mins: endMin - nowMin };
}

function getGreetingSlot(nowMs: number): GreetingSlot {
  const hour = new Date(nowMs).getHours();
  const match = GREETING_SLOTS.find((g) =>
    g.start < g.end
      ? hour >= g.start && hour < g.end
      : hour >= g.start || hour < g.end,
  );
  return match ?? GREETING_SLOTS[0];
}

export default function HomeScreen() {
  useMarkRouteInteractive();
  const t = useT();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const haptic = useHaptics();
  const { width: screenWidth } = useWindowDimensions();
  const courses = useCourseStore((s) => s.courses);
  const termStart = useCourseStore((s) => s.termStart);
  const hasUpdate = useUpdateStore((s) => s.hasUpdate);
  const openUpdateModal = useUpdateStore((s) => s.openModal);
  const colorPalette = useScheduleStore((s) => s.colorPalette);
  const courseColorOverrides = useScheduleStore((s) => s.courseColorOverrides);
  const hasBgImage = useScheduleStore((s) => !!s.backgroundImageUri);
  const announcements = useAnnouncementStore((s) => s.announcements);
  const dismissedIds = useAnnouncementStore((s) => s.dismissedIds);

  const activeAnnouncements = useMemo(
    () => filterActiveAnnouncements(announcements, dismissedIds),
    [announcements, dismissedIds],
  );

  // 按分钟刷新，驱动倒计时 / 已结束状态 / 问候语随时间更新
  const nowMs = useMinuteNow();

  const greetingSlot = getGreetingSlot(nowMs);
  const greeting = {
    title: t(greetingSlot.titleKey),
    sub: t(greetingSlot.subKey),
  };
  const vacation = isVacation(termStart);

  const now = new Date(nowMs);
  const dayIdx = getCurrentDayOfWeek();
  const dayLabels = getDayLabels();
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const dateContext = vacation
    ? t("home.vacationContext", {
        weekday: dayLabels[dayIdx - 1],
        m: month,
        d: date,
      })
    : t("home.weekContext", {
        week: getCurrentWeek(termStart),
        weekday: dayLabels[dayIdx - 1],
        m: month,
        d: date,
      });

  const week = getCurrentWeek(termStart);
  const today = getCurrentDayOfWeek();
  const tomorrowDay = getTomorrowDayOfWeek();
  const tomorrowWeek = getTomorrowWeek(termStart);

  const todayCourses = useMemo(
    () =>
      courses
        .filter(
          (c) => c.day === today && c.weekStart <= week && c.weekEnd >= week,
        )
        .sort((a, b) => a.sectionStart - b.sectionStart),
    [courses, today, week],
  );

  const tomorrowCourses = useMemo(
    () =>
      courses
        .filter(
          (c) =>
            c.day === tomorrowDay &&
            c.weekStart <= tomorrowWeek &&
            c.weekEnd >= tomorrowWeek,
        )
        .sort((a, b) => a.sectionStart - b.sectionStart),
    [courses, tomorrowDay, tomorrowWeek],
  );

  const paletteColors = colorPalette.colors;
  const colorMap = useMemo(
    () => buildColorMap(courses, paletteColors.length),
    [courses, paletteColors.length],
  );
  const hasCourses = courses.length > 0;

  const finishedCount = useMemo(
    () => todayCourses.filter((c) => isCourseFinished(c, nowMs)).length,
    [todayCourses, nowMs],
  );

  const allTodayFinished =
    todayCourses.length > 0 && finishedCount === todayCourses.length;

  const [activeTab, setActiveTab] = useState(() => (allTodayFinished ? 1 : 0));
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  const openCourseDetail = useCallback(
    (course: Course) => {
      haptic();
      setSelectedCourse(course);
    },
    [haptic],
  );

  const handleEditCourse = useCallback((course: Course) => {
    setSelectedCourse(null);
    router.push({
      pathname: "/(pages)/settings/course/add",
      params: { name: course.name },
    });
  }, []);

  const pagerRef = useRef<ScrollView>(null);
  const scrollProgress = useSharedValue(allTodayFinished ? 1 : 0);
  const didInitialScroll = useRef(false);

  useEffect(() => {
    if (allTodayFinished && !didInitialScroll.current) {
      didInitialScroll.current = true;
      requestAnimationFrame(() => {
        pagerRef.current?.scrollTo({ x: screenWidth, animated: false });
      });
    }
  }, [allTodayFinished, screenWidth]);

  const handlePagerScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const progress = e.nativeEvent.contentOffset.x / screenWidth;
      // eslint-disable-next-line react-hooks/immutability
      scrollProgress.value = Math.max(0, Math.min(1, progress));
    },
    [screenWidth, scrollProgress],
  );

  const handlePagerMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const page = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
      setActiveTab((prev) => {
        if (prev !== page) haptic();
        return page;
      });
    },
    [screenWidth, haptic],
  );

  const switchTab = useCallback(
    (tab: number) => {
      haptic();
      setActiveTab(tab);
      // eslint-disable-next-line react-hooks/immutability
      scrollProgress.value = withTiming(tab, { duration: 280 });
      pagerRef.current?.scrollTo({ x: tab * screenWidth, animated: true });
    },
    [screenWidth, scrollProgress, haptic],
  );

  const [tabWidths, setTabWidths] = useState<[number, number]>([0, 0]);
  const handleTabLayout = useCallback((idx: number, e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    setTabWidths((prev) => {
      const next: [number, number] = [...prev];
      next[idx] = width;
      return next;
    });
  }, []);

  const TAB_GAP = 20;
  const underlineStyle = useAnimatedStyle(() => {
    const p = scrollProgress.value;
    const w0 = tabWidths[0] || 60;
    const w1 = tabWidths[1] || 60;
    const width = w0 + (w1 - w0) * p;
    const x = p * (w0 + TAB_GAP);
    return {
      width,
      transform: [{ translateX: x }],
    };
  });

  const firstUpcomingIdx = useMemo(
    () => todayCourses.findIndex((c) => !isCourseFinished(c, nowMs)),
    [todayCourses, nowMs],
  );

  const courseScrollRef = useRef<FlatList<Course>>(null);
  const didAutoScroll = useRef(false);
  const cardHeights = useRef<number[]>([]);

  const handleCardLayout = useCallback(
    (index: number, e: LayoutChangeEvent) => {
      cardHeights.current[index] = e.nativeEvent.layout.height;

      if (
        !didAutoScroll.current &&
        cardHeights.current.filter(Boolean).length === todayCourses.length &&
        firstUpcomingIdx > 0
      ) {
        didAutoScroll.current = true;
        let scrollY = 0;
        for (let i = 0; i < firstUpcomingIdx; i++) {
          scrollY += (cardHeights.current[i] ?? 0) + CARD_GAP;
        }
        courseScrollRef.current?.scrollToOffset({
          offset: scrollY,
          animated: true,
        });
      }
    },
    [todayCourses.length, firstUpcomingIdx],
  );

  function courseColorOf(name: string) {
    return getCourseColor(
      name,
      colorMap,
      paletteColors,
      colorPalette.overrides,
      courseColorOverrides,
    );
  }

  const tabs = [
    { label: t("home.tabToday"), count: todayCourses.length },
    { label: t("home.tabTomorrow"), count: tomorrowCourses.length },
  ];

  return (
    <View style={{ flex: 1 }}>
      <TabBackground />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <View className="flex-1">
          <View className="px-6 pb-2 pt-8">
            <View className="flex-row items-center justify-between">
              <Text
                className="text-[32px] font-bold tracking-tight text-neutral-900 dark:text-neutral-50"
                numberOfLines={1}
              >
                {greeting.title}
              </Text>
              {hasUpdate && (
                <Pressable
                  className="relative p-1 active:opacity-60"
                  onPress={() => {
                    haptic();
                    openUpdateModal();
                  }}
                >
                  <Ionicons
                    name="arrow-up-circle-outline"
                    size={24}
                    color={isDark ? "#a3a3a3" : "#737373"}
                  />
                  <View className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500 dark:border-neutral-900" />
                </Pressable>
              )}
            </View>
            <Text
              className={`mt-1.5 text-base ${
                hasBgImage
                  ? "text-neutral-500 dark:text-neutral-400"
                  : "text-neutral-400 dark:text-neutral-500"
              }`}
            >
              {greeting.sub}
            </Text>
            <View className="mt-3 flex-row items-center gap-1.5">
              <Ionicons
                name="calendar-outline"
                size={13}
                color={isDark ? "#737373" : "#a3a3a3"}
              />
              <Text className="text-sm text-neutral-500 dark:text-neutral-400">
                {dateContext}
              </Text>
            </View>
          </View>

          <AnnouncementBanner
            announcements={activeAnnouncements}
            isDark={isDark}
          />

          <View
            className={`mx-6 my-5 h-px ${
              hasBgImage
                ? "bg-neutral-400/40 dark:bg-neutral-500/40"
                : "bg-neutral-100 dark:bg-neutral-800/60"
            }`}
          />

          {vacation ? (
            <VacationState isDark={isDark} hasBg={hasBgImage} />
          ) : (
            <>
              <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ flexDirection: "row", gap: TAB_GAP }}>
                    {tabs.map((tab, i) => (
                      <Pressable
                        key={tab.label}
                        onPress={() => switchTab(i)}
                        onLayout={(e) => handleTabLayout(i, e)}
                        style={{ paddingBottom: 8 }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 18,
                              fontWeight: activeTab === i ? "700" : "500",
                              color:
                                activeTab === i
                                  ? isDark
                                    ? "#f5f5f5"
                                    : "#171717"
                                  : hasBgImage
                                    ? isDark
                                      ? "#8e8e93"
                                      : "#737373"
                                    : isDark
                                      ? "#525252"
                                      : "#b5b5b5",
                            }}
                          >
                            {tab.label}
                          </Text>
                          {hasCourses && tab.count > 0 && (
                            <View
                              style={{
                                backgroundColor:
                                  activeTab === i
                                    ? hasBgImage
                                      ? isDark
                                        ? "rgba(30,58,138,0.55)"
                                        : "rgba(219,234,254,0.9)"
                                      : isDark
                                        ? "rgba(59,130,246,0.15)"
                                        : "rgba(59,130,246,0.1)"
                                    : hasBgImage
                                      ? isDark
                                        ? "rgba(28,28,30,0.55)"
                                        : "rgba(255,255,255,0.6)"
                                      : isDark
                                        ? "rgba(255,255,255,0.05)"
                                        : "rgba(0,0,0,0.03)",
                                borderRadius: 99,
                                paddingHorizontal: 7,
                                paddingVertical: 1.5,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: "700",
                                  fontVariant: ["tabular-nums"],
                                  color:
                                    activeTab === i
                                      ? isDark
                                        ? "#60a5fa"
                                        : "#3b82f6"
                                      : hasBgImage
                                        ? isDark
                                          ? "#737373"
                                          : "#9ca3af"
                                        : isDark
                                          ? "#404040"
                                          : "#c4c4c4",
                                }}
                              >
                                {tab.count}
                              </Text>
                            </View>
                          )}
                        </View>
                      </Pressable>
                    ))}
                  </View>

                  {activeTab === 0 &&
                    hasCourses &&
                    todayCourses.length > 0 &&
                    finishedCount > 0 && (
                      <Text
                        style={{
                          fontSize: 12,
                          fontVariant: ["tabular-nums"],
                          color: hasBgImage
                            ? isDark
                              ? "#8e8e93"
                              : "#737373"
                            : isDark
                              ? "#525252"
                              : "#a3a3a3",
                        }}
                      >
                        {finishedCount}/{todayCourses.length}
                      </Text>
                    )}
                </View>

                <View style={{ height: 2 }}>
                  <Animated.View
                    style={[
                      {
                        height: 2,
                        borderRadius: 1,
                        backgroundColor: isDark
                          ? "rgba(59,130,246,0.7)"
                          : "#3b82f6",
                      },
                      underlineStyle,
                    ]}
                  />
                </View>
              </View>

              <ScrollView
                ref={pagerRef}
                style={{ flex: 1 }}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handlePagerScroll}
                onMomentumScrollEnd={handlePagerMomentumEnd}
                scrollEventThrottle={16}
                contentContainerStyle={{ flexGrow: 1 }}
              >
                <View style={{ width: screenWidth, flex: 1 }}>
                  {hasCourses && todayCourses.length > 0 ? (
                    <FlatList
                      ref={courseScrollRef}
                      data={todayCourses}
                      keyExtractor={(course, i) =>
                        `today-${course.name}-${course.sectionStart}-${i}`
                      }
                      contentContainerStyle={{
                        gap: CARD_GAP,
                        paddingHorizontal: 24,
                        paddingBottom: 32,
                        flexGrow: 1,
                      }}
                      showsVerticalScrollIndicator={false}
                      renderItem={({ item: course, index: i }) => {
                        const past = isCourseFinished(course, nowMs);
                        const countdown =
                          !past && i === firstUpcomingIdx
                            ? getCourseCountdown(course, nowMs)
                            : null;
                        return (
                          <View onLayout={(e) => handleCardLayout(i, e)}>
                            <CourseCard
                              course={course}
                              color={courseColorOf(course.name)}
                              past={past}
                              countdownKind={countdown?.kind ?? null}
                              countdownText={
                                countdown
                                  ? t(
                                      countdown.kind === "start"
                                        ? "home.countdownStartIn"
                                        : "home.countdownEndIn",
                                      { n: countdown.mins },
                                    )
                                  : null
                              }
                              isDark={isDark}
                              hasBg={hasBgImage}
                              onPress={() => openCourseDetail(course)}
                            />
                          </View>
                        );
                      }}
                    />
                  ) : (
                    <EmptyState
                      hasCourses={hasCourses}
                      isDark={isDark}
                      hasBg={hasBgImage}
                      variant="today"
                    />
                  )}
                </View>

                <View style={{ width: screenWidth, flex: 1 }}>
                  {hasCourses && tomorrowCourses.length > 0 ? (
                    <FlatList
                      data={tomorrowCourses}
                      keyExtractor={(course, i) =>
                        `tmr-${course.name}-${course.sectionStart}-${i}`
                      }
                      contentContainerStyle={{
                        gap: CARD_GAP,
                        paddingHorizontal: 24,
                        paddingBottom: 32,
                        flexGrow: 1,
                      }}
                      showsVerticalScrollIndicator={false}
                      renderItem={({ item: course }) => (
                        <CourseCard
                          course={course}
                          color={courseColorOf(course.name)}
                          past={false}
                          countdownKind={null}
                          countdownText={null}
                          isDark={isDark}
                          hasBg={hasBgImage}
                          onPress={() => openCourseDetail(course)}
                        />
                      )}
                    />
                  ) : (
                    <EmptyState
                      hasCourses={hasCourses}
                      isDark={isDark}
                      hasBg={hasBgImage}
                      variant="tomorrow"
                    />
                  )}
                </View>
              </ScrollView>
            </>
          )}
        </View>
      </SafeAreaView>

      <CourseDetailModal
        course={selectedCourse}
        headerColor={
          selectedCourse ? courseColorOf(selectedCourse.name) : "transparent"
        }
        onClose={() => setSelectedCourse(null)}
        onEdit={handleEditCourse}
      />
    </View>
  );
}

const CourseCard = memo(function CourseCard({
  course,
  color,
  past,
  countdownKind,
  countdownText,
  isDark,
  hasBg,
  onPress,
}: {
  course: Course;
  color: string;
  past: boolean;
  countdownKind: Countdown["kind"] | null;
  countdownText: string | null;
  isDark: boolean;
  hasBg: boolean;
  onPress: () => void;
}) {
  const barColor = past
    ? isDark
      ? "rgba(255,255,255,0.1)"
      : "rgba(0,0,0,0.08)"
    : color;
  const nameColor = past
    ? isDark
      ? "#525252"
      : "#a3a3a3"
    : isDark
      ? "#f5f5f5"
      : "#1c1c1e";
  const subColor = past
    ? isDark
      ? "#404040"
      : "#c4c4c4"
    : isDark
      ? "#a3a3a3"
      : "#737373";

  // 有背景图时改用近实底卡片（参考主流课表 App 壁纸模式的白卡做法），
  // 保证卡片内文字不被图片纹理干扰；细描边用于和壁纸划清边界
  const cardBg = hasBg
    ? isDark
      ? "rgba(28,28,30,0.88)"
      : "rgba(255,255,255,0.92)"
    : isDark
      ? "rgba(255,255,255,0.04)"
      : "rgba(0,0,0,0.025)";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        borderRadius: 12,
        backgroundColor: cardBg,
        overflow: "hidden",
        borderWidth: hasBg ? StyleSheet.hairlineWidth : 0,
        borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)",
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <View
        style={{
          width: 4,
          backgroundColor: barColor,
          borderTopLeftRadius: 12,
          borderBottomLeftRadius: 12,
        }}
      />
      <View style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 12 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: nameColor,
              flex: 1,
            }}
            numberOfLines={1}
          >
            {course.name}
          </Text>
          {countdownKind && countdownText && (
            <View
              style={{
                marginLeft: 8,
                backgroundColor:
                  countdownKind === "end"
                    ? "rgba(234,179,8,0.12)"
                    : "rgba(59,130,246,0.12)",
                borderRadius: 6,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: countdownKind === "end" ? "#ca8a04" : "#3b82f6",
                }}
              >
                {countdownText}
              </Text>
            </View>
          )}
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: 5,
            gap: 12,
          }}
        >
          <ChipInfo
            icon="time-outline"
            text={formatCourseSectionTimeRange(
              course.sectionStart,
              course.sectionEnd,
            )}
            color={subColor}
          />
          <ChipInfo
            icon="location-outline"
            text={course.room}
            color={subColor}
          />
        </View>
      </View>
    </Pressable>
  );
});

function ChipInfo({
  icon,
  text,
  color,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  text: string;
  color: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={{ fontSize: 12, color }} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function EmptyState({
  hasCourses,
  isDark,
  hasBg = false,
  variant = "today",
}: {
  hasCourses: boolean;
  isDark: boolean;
  hasBg?: boolean;
  variant?: "today" | "tomorrow";
}) {
  const t = useT();
  const isTomorrow = variant === "tomorrow";
  const title = !hasCourses
    ? t("home.emptyNoCourses")
    : isTomorrow
      ? t("home.emptyTomorrowNone")
      : t("home.emptyTodayNone");
  const sub = !hasCourses
    ? t("home.emptyNoCoursesSub")
    : isTomorrow
      ? t("home.emptyTomorrowNoneSub")
      : t("home.emptyTodayNoneSub");
  const iconName: React.ComponentProps<typeof Ionicons>["name"] = !hasCourses
    ? "calendar-outline"
    : isTomorrow
      ? "moon-outline"
      : "sunny-outline";

  return (
    <View
      style={{
        alignItems: "center",
        paddingTop: 48,
        paddingHorizontal: 24,
        gap: 12,
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: hasBg
            ? isDark
              ? "rgba(28,28,30,0.85)"
              : "rgba(255,255,255,0.85)"
            : isDark
              ? "rgba(255,255,255,0.06)"
              : "rgba(0,0,0,0.04)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Ionicons
          name={iconName}
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
        {title}
      </Text>
      <Text
        style={{
          fontSize: 13,
          color: hasBg
            ? isDark
              ? "#737373"
              : "#8a8a8e"
            : isDark
              ? "#525252"
              : "#a3a3a3",
          textAlign: "center",
          lineHeight: 20,
        }}
      >
        {sub}
      </Text>
    </View>
  );
}

function VacationState({
  isDark,
  hasBg = false,
}: {
  isDark: boolean;
  hasBg?: boolean;
}) {
  const t = useT();
  return (
    <View
      style={{
        alignItems: "center",
        paddingTop: 48,
        paddingHorizontal: 24,
        gap: 12,
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: hasBg
            ? isDark
              ? "rgba(28,28,30,0.85)"
              : "rgba(255,255,255,0.85)"
            : isDark
              ? "rgba(255,255,255,0.06)"
              : "rgba(0,0,0,0.04)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Ionicons
          name="airplane-outline"
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
        {t("home.vacationTitle")}
      </Text>
      <Text
        style={{
          fontSize: 13,
          color: isDark ? "#525252" : "#a3a3a3",
          textAlign: "center",
          lineHeight: 20,
        }}
      >
        {t("home.vacationSub")}
      </Text>
    </View>
  );
}
