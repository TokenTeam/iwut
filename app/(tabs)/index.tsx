import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
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

import { DAY_LABELS } from "@/components/layout/schedule";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useHaptics } from "@/hooks/use-haptics";
import {
  getCurrentDayOfWeek,
  getCurrentWeek,
  getTomorrowDayOfWeek,
  getTomorrowWeek,
  isVacation,
} from "@/lib/date";
import {
  formatCourseSectionTimeRange,
  SECTION_TIMES,
} from "@/services/course-time";
import type { Course } from "@/store/course";
import { useCourseStore } from "@/store/course";
import { useScheduleStore } from "@/store/schedule";
import { useUpdateStore } from "@/store/update";

const GREETINGS: { start: number; end: number; title: string; sub: string }[] =
  [
    { start: 5, end: 8, title: "早安", sub: "新的一天，从此刻开始" },
    { start: 8, end: 11, title: "上午好", sub: "今天也要元气满满" },
    { start: 11, end: 13, title: "午安", sub: "记得好好吃饭哦" },
    { start: 13, end: 17, title: "下午好", sub: "继续加油" },
    { start: 17, end: 19, title: "傍晚了", sub: "忙碌了一天，辛苦啦" },
    { start: 19, end: 23, title: "晚上好", sub: "忙完了就早点休息" },
    { start: 23, end: 5, title: "夜深了", sub: "熬夜伤身，早点睡哦" },
  ];

const CARD_GAP = 10;

function isCourseFinished(course: Course): boolean {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin > (SECTION_TIMES[course.sectionEnd]?.[3] ?? 0);
}

function getCourseCountdown(course: Course): string | null {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = SECTION_TIMES[course.sectionStart]?.[2] ?? 0;
  const endMin = SECTION_TIMES[course.sectionEnd]?.[3] ?? 0;

  if (nowMin > endMin) return null;
  if (nowMin < startMin) {
    const diff = startMin - nowMin;
    return diff <= 60 ? `${diff} 分钟后开始` : null;
  }
  const remaining = endMin - nowMin;
  return `${remaining} 分钟后结束`;
}

function getGreeting() {
  const hour = new Date().getHours();
  const match = GREETINGS.find((g) =>
    g.start < g.end
      ? hour >= g.start && hour < g.end
      : hour >= g.start || hour < g.end,
  );
  return match ?? GREETINGS[0];
}

function getDateContext(termStart: string, vacation: boolean) {
  const now = new Date();
  const day = getCurrentDayOfWeek();
  const month = now.getMonth() + 1;
  const date = now.getDate();
  if (vacation) {
    return `假期中 · ${DAY_LABELS[day - 1]} · ${month}月${date}日`;
  }
  const week = getCurrentWeek(termStart);
  return `第 ${week} 周 · ${DAY_LABELS[day - 1]} · ${month}月${date}日`;
}

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const router = useRouter();
  const haptic = useHaptics();
  const { width: screenWidth } = useWindowDimensions();
  const courses = useCourseStore((s) => s.courses);
  const termStart = useCourseStore((s) => s.termStart);
  const hasUpdate = useUpdateStore((s) => s.hasUpdate);
  const colorPalette = useScheduleStore((s) => s.colorPalette);
  const courseColorOverrides = useScheduleStore((s) => s.courseColorOverrides);

  const greeting = getGreeting();
  const vacation = isVacation(termStart);
  const dateContext = getDateContext(termStart, vacation);

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
  const colorMap = useMemo(() => {
    const map = new Map<string, number>();
    let idx = 0;
    for (const c of courses) {
      if (!map.has(c.name)) {
        map.set(c.name, idx % paletteColors.length);
        idx++;
      }
    }
    return map;
  }, [courses, paletteColors.length]);
  const hasCourses = courses.length > 0;

  const finishedCount = useMemo(
    () => todayCourses.filter((c) => isCourseFinished(c)).length,
    [todayCourses],
  );

  const allTodayFinished =
    todayCourses.length > 0 && finishedCount === todayCourses.length;

  const [activeTab, setActiveTab] = useState(() => (allTodayFinished ? 1 : 0));

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
    () => todayCourses.findIndex((c) => !isCourseFinished(c)),
    [todayCourses],
  );

  const courseScrollRef = useRef<ScrollView>(null);
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
        courseScrollRef.current?.scrollTo({ y: scrollY, animated: true });
      }
    },
    [todayCourses.length, firstUpcomingIdx],
  );

  function getCourseColor(name: string) {
    return (
      courseColorOverrides[name] ??
      colorPalette.overrides?.[name] ??
      paletteColors[(colorMap.get(name) ?? 0) % paletteColors.length]
    );
  }

  const tabs = [
    { label: "今日", count: todayCourses.length },
    { label: "明日", count: tomorrowCourses.length },
  ];

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
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
                onPress={() => router.push("/about" as any)}
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
          <Text className="mt-1.5 text-base text-neutral-400 dark:text-neutral-500">
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

        <View className="mx-6 my-5 h-px bg-neutral-100 dark:bg-neutral-800/60" />

        {vacation ? (
          <VacationState isDark={isDark} />
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
                                  ? isDark
                                    ? "rgba(59,130,246,0.15)"
                                    : "rgba(59,130,246,0.1)"
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
                        color: isDark ? "#525252" : "#a3a3a3",
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
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handlePagerScroll}
              onMomentumScrollEnd={handlePagerMomentumEnd}
              scrollEventThrottle={16}
            >
              <View style={{ width: screenWidth }}>
                {hasCourses && todayCourses.length > 0 ? (
                  <ScrollView
                    ref={courseScrollRef}
                    contentContainerStyle={{
                      gap: CARD_GAP,
                      paddingHorizontal: 24,
                    }}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                  >
                    {todayCourses.map((course, i) => {
                      const past = isCourseFinished(course);
                      const countdown =
                        !past && i === firstUpcomingIdx
                          ? getCourseCountdown(course)
                          : null;
                      return (
                        <View
                          key={`today-${course.name}-${course.sectionStart}-${i}`}
                          onLayout={(e) => handleCardLayout(i, e)}
                        >
                          <CourseCard
                            course={course}
                            color={getCourseColor(course.name)}
                            past={past}
                            countdown={countdown}
                            isDark={isDark}
                          />
                        </View>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <EmptyState
                    hasCourses={hasCourses}
                    isDark={isDark}
                    variant="today"
                  />
                )}
              </View>

              <View style={{ width: screenWidth }}>
                {hasCourses && tomorrowCourses.length > 0 ? (
                  <ScrollView
                    contentContainerStyle={{
                      gap: CARD_GAP,
                      paddingHorizontal: 24,
                    }}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                  >
                    {tomorrowCourses.map((course, i) => (
                      <View
                        key={`tmr-${course.name}-${course.sectionStart}-${i}`}
                      >
                        <CourseCard
                          course={course}
                          color={getCourseColor(course.name)}
                          past={false}
                          countdown={null}
                          isDark={isDark}
                        />
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <EmptyState
                    hasCourses={hasCourses}
                    isDark={isDark}
                    variant="tomorrow"
                  />
                )}
              </View>
            </ScrollView>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function CourseCard({
  course,
  color,
  past,
  countdown,
  isDark,
}: {
  course: Course;
  color: string;
  past: boolean;
  countdown: string | null;
  isDark: boolean;
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

  return (
    <View
      style={{
        flexDirection: "row",
        borderRadius: 12,
        backgroundColor: isDark
          ? "rgba(255,255,255,0.04)"
          : "rgba(0,0,0,0.025)",
        overflow: "hidden",
      }}
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
          {countdown && (
            <View
              style={{
                marginLeft: 8,
                backgroundColor: countdown.includes("结束")
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
                  color: countdown.includes("结束") ? "#ca8a04" : "#3b82f6",
                }}
              >
                {countdown}
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
    </View>
  );
}

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
  variant = "today",
}: {
  hasCourses: boolean;
  isDark: boolean;
  variant?: "today" | "tomorrow";
}) {
  const isTomorrow = variant === "tomorrow";
  const title = !hasCourses
    ? "还没有课程"
    : isTomorrow
      ? "明天没有课程"
      : "今天没有课程";
  const sub = !hasCourses
    ? "前往「课程」标签页导入你的课表"
    : isTomorrow
      ? "明天可以好好休息了"
      : "好好享受空闲时光吧";
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
          backgroundColor: isDark
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
          color: isDark ? "#525252" : "#a3a3a3",
          textAlign: "center",
          lineHeight: 20,
        }}
      >
        {sub}
      </Text>
    </View>
  );
}

function VacationState({ isDark }: { isDark: boolean }) {
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
          backgroundColor: isDark
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
        假期中
      </Text>
      <Text
        style={{
          fontSize: 13,
          color: isDark ? "#525252" : "#a3a3a3",
          textAlign: "center",
          lineHeight: 20,
        }}
      >
        假期愉快~
      </Text>
    </View>
  );
}
