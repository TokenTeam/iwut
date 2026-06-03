import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { useHaptics } from "@/hooks/use-haptics";
import { getTermWeekDayNumbers, getTermWeekMonthLabel } from "@/lib/date";
import { t, useT } from "@/lib/i18n";
import { formatCourseSectionTimeRange } from "@/services/course-time";
import type { Course } from "@/store/course";
import { useScheduleStore } from "@/store/schedule";

import {
  QuickAddCourseModal,
  type QuickAddSlot,
} from "./quick-add-course-modal";
import {
  getAndroidBlurProps,
  useAndroidBlurTarget,
} from "@/components/ui/app-blur-target";

const DAY_KEYS = [
  "schedule.weekday.mon",
  "schedule.weekday.tue",
  "schedule.weekday.wed",
  "schedule.weekday.thu",
  "schedule.weekday.fri",
  "schedule.weekday.sat",
  "schedule.weekday.sun",
] as const;

export function getDayLabels(): string[] {
  return DAY_KEYS.map((k) => t(k));
}

interface SidebarLabel {
  label: string;
  firstSection: number;
  lastSection: number;
}

const SECTION_GROUPS_FULL: number[][] = [
  [1, 2],
  [3, 4, 5],
  [6, 7],
  [8, 9, 10],
  [11, 12],
  [13],
  [14, 15, 16],
];

const SECTION_GROUPS_COMPACT: number[][] = [
  [1, 2],
  [3, 4, 5],
  [8, 9, 10],
  [11, 12],
  [14, 15, 16],
];

function getSidebarLabelsFull(): SidebarLabel[] {
  return [
    { label: t("schedule.sidebar.morning"), firstSection: 1, lastSection: 5 },
    { label: t("schedule.sidebar.midday"), firstSection: 6, lastSection: 7 },
    {
      label: t("schedule.sidebar.afternoon"),
      firstSection: 8,
      lastSection: 12,
    },
    {
      label: t("schedule.sidebar.eveningEarly"),
      firstSection: 13,
      lastSection: 13,
    },
    { label: t("schedule.sidebar.night"), firstSection: 14, lastSection: 16 },
  ];
}

function getSidebarLabelsCompact(): SidebarLabel[] {
  return [
    { label: t("schedule.sidebar.morning"), firstSection: 1, lastSection: 5 },
    {
      label: t("schedule.sidebar.afternoon"),
      firstSection: 8,
      lastSection: 12,
    },
    { label: t("schedule.sidebar.night"), firstSection: 14, lastSection: 16 },
  ];
}

const HEADER_HEIGHT = 36;
const HEADER_HEIGHT_WITH_DATES = 44;
const SIDEBAR_WIDTH = 24;
const PEEK_WIDTH = 20;

function pct(n: number): `${number}%` {
  return `${n}%` as `${number}%`;
}

function buildColorMap(
  courses: Course[],
  paletteSize: number,
): Map<string, number> {
  const map = new Map<string, number>();
  let idx = 0;
  for (const c of courses) {
    if (!map.has(c.name)) {
      map.set(c.name, idx % paletteSize);
      idx++;
    }
  }
  return map;
}

function getCourseColor(
  courseName: string,
  colorMap: Map<string, number>,
  paletteColors: string[],
  paletteOverrides: Record<string, string> | undefined,
  courseColorOverrides: Record<string, string>,
): string {
  if (courseColorOverrides[courseName]) return courseColorOverrides[courseName];
  if (paletteOverrides?.[courseName]) return paletteOverrides[courseName];
  return paletteColors[(colorMap.get(courseName) ?? 0) % paletteColors.length];
}

// 把任意节次范围对齐到 section group 的边界，用于同时段加课预填。
// 若 sectionStart 和 sectionEnd 落在不同 group，则取 [start所在group的首节, end所在group的尾节]。
function alignToSectionGroup(
  groups: number[][],
  sectionStart: number,
  sectionEnd: number,
): { start: number; end: number } | null {
  const startGroup = groups.find((g) => g.includes(sectionStart));
  const endGroup = groups.find((g) => g.includes(sectionEnd));
  if (!startGroup || !endGroup) return null;
  return {
    start: startGroup[0],
    end: endGroup[endGroup.length - 1],
  };
}

function buildDayCourses(courses: Course[]): Course[][] {
  const days: Course[][] = Array.from({ length: 7 }, () => []);
  for (const c of courses) {
    const d = c.day - 1;
    if (d >= 0 && d < 7) {
      days[d].push(c);
    }
  }
  return days;
}

interface LayoutInfo {
  sectionTop: Record<number, number>;
  sectionPct: number;
  groups: number[][];
  sidebarLabels: SidebarLabel[];
}

function computeLayout(
  groups: number[][],
  sidebarLabels: SidebarLabel[],
): LayoutInfo {
  const totalSections = groups.reduce((sum, g) => sum + g.length, 0);
  const sectionPct = 100 / totalSections;

  const sectionTop: Record<number, number> = {};
  let y = 0;
  for (const group of groups) {
    for (const sec of group) {
      sectionTop[sec] = y;
      y += sectionPct;
    }
  }

  return { sectionTop, sectionPct, groups, sidebarLabels };
}

export function Schedule({
  courses,
  week,
  today,
  termStart,
}: Readonly<{
  courses: Course[];
  week: number;
  today?: number;
  termStart?: string;
}>) {
  const localT = useT();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const blurTarget = useAndroidBlurTarget();
  const [selected, setSelected] = useState<Course | null>(null);
  const [slotCourses, setSlotCourses] = useState<Course[] | null>(null);
  const [quickAddSlot, setQuickAddSlot] = useState<QuickAddSlot | null>(null);

  const haptic = useHaptics();
  const scrollWeekend = useScheduleStore((s) => s.scrollWeekend);
  const showMidday = useScheduleStore((s) => s.showMiddaySections);
  const showOtherWeekCourses = useScheduleStore((s) => s.showOtherWeekCourses);
  const colorPalette = useScheduleStore((s) => s.colorPalette);
  const courseColorOverrides = useScheduleStore((s) => s.courseColorOverrides);
  const backgroundImageUri = useScheduleStore((s) => s.backgroundImageUri);
  const paletteColors = colorPalette.colors;
  const hasBgImage = !!backgroundImageUri;
  const emptyBg = hasBgImage
    ? "rgba(255,255,255,0.08)"
    : isDark
      ? "rgba(255,255,255,0.03)"
      : "rgba(0,0,0,0.02)";
  const mutedColor = isDark ? "#a3a3a3" : "#737373";
  const subtleColor = isDark ? "#525252" : "#a3a3a3";
  const primaryTextColor = isDark ? "#e5e5e5" : "#1c1c1e";
  const otherWeekTextColor = isDark ? "#737373" : "#c4c4c4";
  const otherWeekColor = isDark ? "#525252" : "#9ca3af";

  const dayLabels = useMemo(() => DAY_KEYS.map((k) => localT(k)), [localT]);
  const monthLabelSuffix = localT("common.monthSuffix");

  const layout = useMemo(
    () =>
      showMidday
        ? computeLayout(SECTION_GROUPS_FULL, getSidebarLabelsFull())
        : computeLayout(SECTION_GROUPS_COMPACT, getSidebarLabelsCompact()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showMidday, localT],
  );

  const colorMap = useMemo(
    () => buildColorMap(courses, paletteColors.length),
    [courses, paletteColors.length],
  );

  const isInCurrentWeek = useCallback(
    (c: Course) => c.weekStart <= week && c.weekEnd >= week,
    [week],
  );

  const currentDayCourses = useMemo(
    () => buildDayCourses(courses.filter(isInCurrentWeek)),
    [courses, isInCurrentWeek],
  );

  const otherDayCoursesAll = useMemo(() => {
    if (!showOtherWeekCourses) return Array.from({ length: 7 }, () => []);
    return buildDayCourses(courses.filter((c) => !isInCurrentWeek(c)));
  }, [courses, isInCurrentWeek, showOtherWeekCourses]);

  // 非本周课程与本周课冲突的全部隐藏；非本周课互相冲突时取
  // 上课时间最早的一门，被隐藏的仍可在冲突列表中看到。
  const otherDayCoursesVisible = useMemo(() => {
    const result: Course[][] = Array.from({ length: 7 }, () => []);
    for (let d = 0; d < 7; d++) {
      const occupied: { start: number; end: number }[] = currentDayCourses[
        d
      ].map((c) => ({ start: c.sectionStart, end: c.sectionEnd }));
      const sorted = [...otherDayCoursesAll[d]].sort(
        (a, b) => a.sectionStart - b.sectionStart,
      );
      for (const c of sorted) {
        const overlap = occupied.some(
          (o) => o.start <= c.sectionEnd && c.sectionStart <= o.end,
        );
        if (overlap) continue;
        occupied.push({ start: c.sectionStart, end: c.sectionEnd });
        result[d].push(c);
      }
    }
    return result;
  }, [currentDayCourses, otherDayCoursesAll]);

  // 每门课对应的同日节次重叠列表，包含自身；本周课在前，非本周课按 weekStart 升序。
  // 使用 otherDayCoursesAll 保证被隐藏的冲突课程也能在列表中展示。
  const conflictsByCourse = useMemo(() => {
    const map = new Map<Course, Course[]>();
    for (let d = 0; d < 7; d++) {
      const allForDay = [...currentDayCourses[d], ...otherDayCoursesAll[d]];
      for (const c of allForDay) {
        const list = allForDay.filter(
          (o) =>
            o.sectionStart <= c.sectionEnd && c.sectionStart <= o.sectionEnd,
        );
        list.sort((a, b) => {
          const aCur = isInCurrentWeek(a) ? 0 : 1;
          const bCur = isInCurrentWeek(b) ? 0 : 1;
          if (aCur !== bCur) return aCur - bCur;
          return a.weekStart - b.weekStart;
        });
        map.set(c, list);
      }
    }
    return map;
  }, [currentDayCourses, otherDayCoursesAll, isInCurrentWeek]);

  const monthLabel = useMemo(
    () => (termStart ? getTermWeekMonthLabel(termStart, week) : null),
    [termStart, week],
  );
  const dayNumbers = useMemo(
    () => (termStart ? getTermWeekDayNumbers(termStart, week) : null),
    [termStart, week],
  );
  const showDates = !!(monthLabel && dayNumbers);

  const headerHeight = showDates ? HEADER_HEIGHT_WITH_DATES : HEADER_HEIGHT;

  const visibleCols = scrollWeekend ? 5 : 7;
  const availableWidth = screenWidth - SIDEBAR_WIDTH;
  const colWidth = scrollWeekend
    ? (availableWidth - PEEK_WIDTH) / visibleCols
    : availableWidth / visibleCols;

  const nameFontSize = scrollWeekend ? 12 : 10;
  const roomFontSize = scrollWeekend ? 10 : 9;

  const colorOf = (name: string) =>
    getCourseColor(
      name,
      colorMap,
      paletteColors,
      colorPalette.overrides,
      courseColorOverrides,
    );

  const scrollRef = useCallback(
    (node: ScrollView | null) => {
      if (node && today && today > 5) {
        node.scrollToEnd({ animated: false });
      }
    },
    [today],
  );

  const handleCoursePress = (course: Course) => {
    haptic();
    const list = conflictsByCourse.get(course) ?? [course];
    if (list.length > 1) {
      setSlotCourses(list);
    } else {
      setSelected(course);
    }
  };

  const handleEditCourse = (course: Course) => {
    haptic();
    setSelected(null);
    setSlotCourses(null);
    router.push({
      pathname: "/(pages)/settings/course/add",
      params: { name: course.name },
    });
  };

  const openQuickAddForCourse = (course: Course) => {
    // 始终用完整分组对齐，避免在 compact 模式下（layout.groups 不含 6/7/13 节）
    // 课程 sectionStart 找不到分组导致"添加课程"按钮静默失效。
    const aligned = alignToSectionGroup(
      SECTION_GROUPS_FULL,
      course.sectionStart,
      course.sectionEnd,
    ) ?? { start: course.sectionStart, end: course.sectionEnd };
    haptic();
    setSelected(null);
    setSlotCourses(null);
    setQuickAddSlot({
      day: course.day,
      sectionStart: aligned.start,
      sectionEnd: aligned.end,
    });
  };

  const renderCourseCell = (course: Course, key: string, isOther: boolean) => {
    if (
      layout.sectionTop[course.sectionStart] === undefined ||
      layout.sectionTop[course.sectionEnd] === undefined
    ) {
      return null;
    }
    const topVal = layout.sectionTop[course.sectionStart];
    const heightVal =
      layout.sectionTop[course.sectionEnd] + layout.sectionPct - topVal;
    const bg = isOther ? emptyBg : colorOf(course.name);
    const span = course.sectionEnd - course.sectionStart + 1;
    const nameLines = 2 * span - 1;
    const nameColor = isOther ? otherWeekTextColor : "#fff";
    const roomColor = isOther ? otherWeekTextColor : "rgba(255,255,255,0.85)";

    return (
      <Pressable
        key={key}
        style={{
          position: "absolute",
          top: pct(topVal),
          height: pct(heightVal),
          left: 0,
          right: 0,
        }}
        onPress={() => handleCoursePress(course)}
      >
        <View
          style={{
            flex: 1,
            margin: 2,
            backgroundColor: bg,
            borderRadius: 6,
            padding: 4,
            overflow: "hidden",
            flexDirection: "column",
          }}
        >
          <View
            style={{
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            <Text
              numberOfLines={nameLines}
              style={{
                fontSize: nameFontSize,
                fontWeight: "bold",
                color: nameColor,
                lineHeight: nameFontSize + 4,
              }}
            >
              {course.name}
            </Text>
            {isOther && (
              <Text
                style={{
                  fontSize: roomFontSize,
                  color: roomColor,
                }}
              >
                {t("schedule.otherWeekTag")}
              </Text>
            )}
          </View>
          <Text
            style={{
              fontSize: roomFontSize,
              color: roomColor,
              flexShrink: 0,
              marginTop: 2,
            }}
          >
            {course.room}
          </Text>
        </View>
      </Pressable>
    );
  };

  const dayColumns = Array.from({ length: 7 }, (_, dayIdx) => {
    const isToday = dayIdx + 1 === today;
    const currentForDay = currentDayCourses[dayIdx];
    const otherForDay = otherDayCoursesVisible[dayIdx];

    return (
      <View key={dayIdx} style={{ width: colWidth }}>
        <View
          style={{
            height: headerHeight,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {showDates && dayNumbers ? (
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                overflow: "hidden",
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: isToday ? "#3b82f6" : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: isToday ? "800" : "600",
                  color: isToday ? "#fff" : isDark ? "#d4d4d4" : "#525252",
                }}
              >
                {dayLabels[dayIdx]}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: isToday ? "700" : "500",
                  fontVariant: ["tabular-nums"],
                  color: isToday ? "#fff" : mutedColor,
                }}
              >
                {dayNumbers[dayIdx]}
              </Text>
            </View>
          ) : (
            <Text
              style={{
                fontSize: 12,
                fontWeight: isToday ? "800" : "600",
                color: isToday ? "#3b82f6" : isDark ? "#d4d4d4" : "#525252",
              }}
            >
              {dayLabels[dayIdx]}
            </Text>
          )}
        </View>

        <View style={{ flex: 1 }}>
          {layout.groups.map((group) => {
            const topVal = layout.sectionTop[group[0]];
            const heightVal =
              layout.sectionTop[group[group.length - 1]] +
              layout.sectionPct -
              topVal;
            const sectionStart = group[0];
            const sectionEnd = group[group.length - 1];
            return (
              <View
                key={group[0]}
                style={{
                  position: "absolute",
                  top: pct(topVal),
                  height: pct(heightVal),
                  left: 0,
                  right: 0,
                }}
              >
                <Pressable
                  style={({ pressed }) => ({
                    flex: 1,
                    margin: 2,
                    backgroundColor: emptyBg,
                    borderRadius: 6,
                    opacity: pressed ? 0.6 : 1,
                  })}
                  onPress={() => {
                    haptic();
                    setQuickAddSlot({
                      day: dayIdx + 1,
                      sectionStart,
                      sectionEnd,
                    });
                  }}
                />
              </View>
            );
          })}

          {otherForDay.map((course, ci) =>
            renderCourseCell(
              course,
              `other-${course.name}-${course.sectionStart}-${course.weekStart}-${ci}`,
              true,
            ),
          )}

          {currentForDay.map((course, ci) =>
            renderCourseCell(
              course,
              `cur-${course.name}-${course.sectionStart}-${ci}`,
              false,
            ),
          )}
        </View>
      </View>
    );
  });

  const columnsContent = (
    <View style={{ flexDirection: "row" }}>{dayColumns}</View>
  );

  return (
    <View style={{ flex: 1, paddingBottom: 8 }}>
      <View style={{ flex: 1, flexDirection: "row" }}>
        <View style={{ width: SIDEBAR_WIDTH }}>
          <View
            style={{
              height: headerHeight,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {showDates && monthLabel ? (
              <View style={{ alignItems: "center" }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    fontVariant: ["tabular-nums"],
                    textAlign: "center",
                    color: mutedColor,
                  }}
                >
                  {monthLabel.split("\n")[0]}
                </Text>
                {monthLabelSuffix ? (
                  <Text
                    style={{
                      fontSize: 8,
                      lineHeight: 10,
                      textAlign: "center",
                      color: mutedColor,
                    }}
                  >
                    {monthLabelSuffix}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
          <View style={{ flex: 1 }}>
            {layout.sidebarLabels.map((sl) => {
              const topVal = layout.sectionTop[sl.firstSection];
              const heightVal =
                layout.sectionTop[sl.lastSection] + layout.sectionPct - topVal;
              return (
                <View
                  key={sl.label}
                  style={{
                    position: "absolute",
                    top: pct(topVal),
                    height: pct(heightVal),
                    left: 0,
                    right: 0,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      color: mutedColor,
                      textAlign: "center",
                      lineHeight: 16,
                    }}
                  >
                    {sl.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {scrollWeekend ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            ref={scrollRef}
          >
            {columnsContent}
          </ScrollView>
        ) : (
          columnsContent
        )}
      </View>

      <QuickAddCourseModal
        slot={quickAddSlot}
        currentWeek={week}
        onClose={() => setQuickAddSlot(null)}
      />

      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setSelected(null)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <BlurView
            {...getAndroidBlurProps(blurTarget)}
            intensity={30}
            tint="dark"
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSelected(null)}
          />
          {selected && (
            <View
              style={{
                width: 300,
                backgroundColor: isDark ? "#1c1c1e" : "#fff",
                borderRadius: 20,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  backgroundColor: isInCurrentWeek(selected)
                    ? colorOf(selected.name)
                    : otherWeekColor,
                  paddingHorizontal: 22,
                  paddingTop: 22,
                  paddingBottom: 18,
                }}
              >
                <Pressable
                  onPress={() => setSelected(null)}
                  style={{ position: "absolute", top: 12, right: 12 }}
                  hitSlop={8}
                >
                  <Ionicons
                    name="close-circle"
                    size={26}
                    color="rgba(255,255,255,0.7)"
                  />
                </Pressable>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginRight: 28,
                  }}
                >
                  <Text
                    numberOfLines={2}
                    style={{
                      flexShrink: 1,
                      fontSize: 19,
                      fontWeight: "700",
                      color: "#fff",
                      lineHeight: 26,
                    }}
                  >
                    {selected.name}
                  </Text>
                  {!isInCurrentWeek(selected) && (
                    <Text
                      style={{
                        marginLeft: 8,
                        fontSize: 10,
                        fontWeight: "600",
                        paddingHorizontal: 6,
                        paddingVertical: 1,
                        borderRadius: 4,
                        overflow: "hidden",
                        color: "#fff",
                        backgroundColor: "rgba(255,255,255,0.22)",
                      }}
                    >
                      {localT("schedule.otherWeekTag")}
                    </Text>
                  )}
                </View>
                <Text
                  style={{
                    fontSize: 13,
                    color: "rgba(255,255,255,0.8)",
                    marginTop: 6,
                  }}
                >
                  {localT("schedule.weekdayWithSection", {
                    weekday: dayLabels[selected.day - 1],
                    start: selected.sectionStart,
                    end: selected.sectionEnd,
                  })}
                </Text>
              </View>

              <View style={{ padding: 20, gap: 14 }}>
                <DetailRow
                  icon="location-outline"
                  label={localT("schedule.room")}
                  value={selected.room}
                  isDark={isDark}
                />
                <DetailRow
                  icon="person-outline"
                  label={localT("schedule.teacher")}
                  value={selected.teacher}
                  isDark={isDark}
                />
                <DetailRow
                  icon="calendar-outline"
                  label={localT("schedule.weeks")}
                  value={localT("schedule.weeksValue", {
                    start: selected.weekStart,
                    end: selected.weekEnd,
                  })}
                  isDark={isDark}
                />
                <DetailRow
                  icon="time-outline"
                  label={localT("schedule.time")}
                  value={
                    formatCourseSectionTimeRange(
                      selected.sectionStart,
                      selected.sectionEnd,
                    ) ||
                    localT("schedule.sectionRange", {
                      start: selected.sectionStart,
                      end: selected.sectionEnd,
                    })
                  }
                  isDark={isDark}
                />
              </View>

              <View
                style={{
                  flexDirection: "row",
                  gap: 8,
                  paddingHorizontal: 16,
                  paddingBottom: 16,
                  paddingTop: 4,
                }}
              >
                <DetailActionButton
                  icon="create-outline"
                  label={localT("schedule.editCourse")}
                  isDark={isDark}
                  onPress={() => handleEditCourse(selected)}
                />
                <DetailActionButton
                  icon="add-circle-outline"
                  label={localT("schedule.addAtSameSlot")}
                  isDark={isDark}
                  onPress={() => openQuickAddForCourse(selected)}
                />
              </View>
            </View>
          )}
        </View>
      </Modal>

      <Modal
        visible={!!slotCourses}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setSlotCourses(null)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <BlurView
            {...getAndroidBlurProps(blurTarget)}
            intensity={30}
            tint="dark"
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSlotCourses(null)}
          />
          {slotCourses && (
            <View
              style={{
                width: 300,
                maxHeight: "75%",
                backgroundColor: isDark ? "#1c1c1e" : "#fff",
                borderRadius: 20,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  backgroundColor: isDark ? "#2c2c2e" : "#475569",
                  paddingHorizontal: 22,
                  paddingTop: 22,
                  paddingBottom: 18,
                }}
              >
                <Pressable
                  onPress={() => setSlotCourses(null)}
                  style={{ position: "absolute", top: 12, right: 12 }}
                  hitSlop={8}
                >
                  <Ionicons
                    name="close-circle"
                    size={26}
                    color="rgba(255,255,255,0.7)"
                  />
                </Pressable>
                <Text
                  style={{
                    fontSize: 19,
                    fontWeight: "700",
                    color: "#fff",
                    marginRight: 28,
                    lineHeight: 26,
                  }}
                >
                  {localT("schedule.slotListTitle")}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: "rgba(255,255,255,0.8)",
                    marginTop: 6,
                  }}
                >
                  {localT("schedule.slotCountValue", {
                    n: slotCourses.length,
                  })}
                </Text>
              </View>

              <ScrollView contentContainerStyle={{ padding: 8 }}>
                {slotCourses.map((c, i) => {
                  const other = !isInCurrentWeek(c);
                  const tileColor = other ? otherWeekColor : colorOf(c.name);
                  return (
                    <Pressable
                      key={`${c.name}-${c.weekStart}-${c.sectionStart}-${i}`}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 12,
                        backgroundColor: pressed
                          ? isDark
                            ? "rgba(255,255,255,0.05)"
                            : "rgba(0,0,0,0.04)"
                          : "transparent",
                      })}
                      onPress={() => {
                        haptic();
                        setSlotCourses(null);
                        setSelected(c);
                      }}
                    >
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          backgroundColor: tileColor,
                          justifyContent: "center",
                          alignItems: "center",
                          marginRight: 12,
                        }}
                      >
                        <Ionicons
                          name={other ? "time-outline" : "book-outline"}
                          size={17}
                          color="rgba(255,255,255,0.9)"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                          }}
                        >
                          <Text
                            numberOfLines={1}
                            style={{
                              flexShrink: 1,
                              fontSize: 15,
                              fontWeight: "500",
                              color: primaryTextColor,
                            }}
                          >
                            {c.name}
                          </Text>
                          {other && (
                            <Text
                              style={{
                                marginLeft: 6,
                                fontSize: 10,
                                fontWeight: "600",
                                paddingHorizontal: 6,
                                paddingVertical: 1,
                                borderRadius: 4,
                                overflow: "hidden",
                                color: isDark ? "#a3a3a3" : "#525252",
                                backgroundColor: isDark
                                  ? "rgba(255,255,255,0.08)"
                                  : "rgba(0,0,0,0.06)",
                              }}
                            >
                              {localT("schedule.otherWeekTag")}
                            </Text>
                          )}
                        </View>
                        <Text
                          style={{
                            marginTop: 1,
                            fontSize: 11,
                            color: mutedColor,
                          }}
                        >
                          {localT("schedule.weeksValue", {
                            start: c.weekStart,
                            end: c.weekEnd,
                          })}
                          {"  ·  "}
                          {localT("schedule.sectionRange", {
                            start: c.sectionStart,
                            end: c.sectionEnd,
                          })}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={subtleColor}
                      />
                    </Pressable>
                  );
                })}

                {slotCourses.length > 0 && (
                  <Pressable
                    onPress={() => openQuickAddForCourse(slotCourses[0])}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderRadius: 12,
                      backgroundColor: pressed
                        ? isDark
                          ? "rgba(255,255,255,0.05)"
                          : "rgba(0,0,0,0.04)"
                        : "transparent",
                    })}
                  >
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderStyle: "dashed",
                        borderColor: isDark
                          ? "rgba(255,255,255,0.22)"
                          : "rgba(0,0,0,0.22)",
                        justifyContent: "center",
                        alignItems: "center",
                        marginRight: 12,
                      }}
                    >
                      <Ionicons name="add" size={18} color={subtleColor} />
                    </View>
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 14,
                        color: mutedColor,
                      }}
                    >
                      {localT("schedule.addAtSameSlot")}
                    </Text>
                  </Pressable>
                )}
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

function DetailActionButton({
  icon,
  label,
  isDark,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  isDark: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 11,
        borderRadius: 12,
        backgroundColor: pressed
          ? isDark
            ? "rgba(255,255,255,0.08)"
            : "rgba(0,0,0,0.06)"
          : isDark
            ? "rgba(255,255,255,0.05)"
            : "rgba(0,0,0,0.04)",
      })}
    >
      <Ionicons name={icon} size={16} color={isDark ? "#d4d4d4" : "#525252"} />
      <Text
        style={{
          marginLeft: 6,
          fontSize: 13,
          fontWeight: "600",
          color: isDark ? "#d4d4d4" : "#525252",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function DetailRow({
  icon,
  label,
  value,
  isDark,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  isDark: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: isDark
            ? "rgba(255,255,255,0.08)"
            : "rgba(0,0,0,0.04)",
          justifyContent: "center",
          alignItems: "center",
          marginRight: 12,
        }}
      >
        <Ionicons
          name={icon}
          size={17}
          color={isDark ? "#a3a3a3" : "#737373"}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 11,
            color: isDark ? "#737373" : "#a3a3a3",
            marginBottom: 1,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontSize: 15,
            fontWeight: "500",
            color: isDark ? "#e5e5e5" : "#1c1c1e",
          }}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}
