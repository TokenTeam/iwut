import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { CourseShareSheet } from "@/components/share/course-share-sheet";
import { WEEKDAY_KEYS } from "@/constants/weekdays";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useHaptics } from "@/hooks/use-haptics";
import { useLatest } from "@/hooks/use-latest";
import { buildColorMap, getCourseColor } from "@/lib/course-colors";
import { MAX_WEEK } from "@/lib/course-weeks";
import { getTermWeekDayNumbers, getTermWeekMonthLabel } from "@/lib/date";
import { useT } from "@/lib/i18n";
import type { Course } from "@/store/course";
import { useScheduleStore } from "@/store/schedule";

import { useAppBlurProps } from "@/components/ui/app-blur-target";
import { CourseDetailModal } from "./course-detail-modal";
import {
  QuickAddCourseModal,
  type QuickAddSlot,
} from "./quick-add-course-modal";
import { DayColumn, type ScheduleCellTheme } from "./schedule-day-column";

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

interface SidebarLabelText {
  morning: string;
  midday: string;
  afternoon: string;
  eveningEarly: string;
  night: string;
}

function getSidebarLabelsFull(text: SidebarLabelText): SidebarLabel[] {
  return [
    { label: text.morning, firstSection: 1, lastSection: 5 },
    { label: text.midday, firstSection: 6, lastSection: 7 },
    {
      label: text.afternoon,
      firstSection: 8,
      lastSection: 12,
    },
    {
      label: text.eveningEarly,
      firstSection: 13,
      lastSection: 13,
    },
    { label: text.night, firstSection: 14, lastSection: 16 },
  ];
}

function getSidebarLabelsCompact(text: SidebarLabelText): SidebarLabel[] {
  return [
    { label: text.morning, firstSection: 1, lastSection: 5 },
    {
      label: text.afternoon,
      firstSection: 8,
      lastSection: 12,
    },
    { label: text.night, firstSection: 14, lastSection: 16 },
  ];
}

const HEADER_HEIGHT = 30;
const HEADER_HEIGHT_WITH_DATES = 40;
const SIDEBAR_WIDTH = 24;
const PEEK_WIDTH = 20;
const WEEK_DATA = Array.from({ length: MAX_WEEK }, (_, i) => i + 1);
const weekKeyExtractor = (item: number) => String(item);
const styles = StyleSheet.create({
  fill: { flex: 1 },
});

// 超出上限时露出下一行的一部分提示可滚动
const SLOT_ROW_HEIGHT = 56;
const SLOT_LIST_PADDING = 8;
const MAX_VISIBLE_SLOT_ROWS = 5;
const SLOT_LIST_VISIBLE_HEIGHT =
  SLOT_LIST_PADDING +
  SLOT_ROW_HEIGHT * MAX_VISIBLE_SLOT_ROWS +
  Math.round(SLOT_ROW_HEIGHT * 0.45);

interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

function pct(n: number): `${number}%` {
  return `${n}%` as `${number}%`;
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

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function formatRgba({ r, g, b, a }: RgbaColor): string {
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${clampUnit(a)})`;
}

function parseColor(color: string): RgbaColor | null {
  const rgbMatch = color.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(",").map((p) => p.trim());
    if (parts.length >= 3) {
      const r = Number.parseFloat(parts[0]);
      const g = Number.parseFloat(parts[1]);
      const b = Number.parseFloat(parts[2]);
      const a = parts.length >= 4 ? Number.parseFloat(parts[3]) : 1;
      if ([r, g, b, a].every(Number.isFinite)) {
        return { r, g, b, a: clampUnit(a) };
      }
    }
  }

  const shortHexMatch = color.match(/^#([0-9a-f]{3})$/i);
  if (shortHexMatch) {
    const [r, g, b] = shortHexMatch[1].split("").map((c) => c + c);
    return {
      r: parseInt(r, 16),
      g: parseInt(g, 16),
      b: parseInt(b, 16),
      a: 1,
    };
  }

  const hexMatch = color.match(/^#([0-9a-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: 1,
    };
  }

  return null;
}

function withColorOpacity(color: string, opacity: number): string {
  const rgba = parseColor(color);
  if (!rgba) return color;
  return formatRgba({ ...rgba, a: rgba.a * clampUnit(opacity) });
}

function withColorAlpha(color: string, opacity: number): string {
  const rgba = parseColor(color);
  if (!rgba) return color;
  return formatRgba({ ...rgba, a: opacity });
}

function blendColorOver(color: string, surfaceColor: string): string {
  const foreground = parseColor(color);
  const surface = parseColor(surfaceColor);
  if (!foreground || !surface) return color;

  const alpha = foreground.a;
  return formatRgba({
    r: foreground.r * alpha + surface.r * (1 - alpha),
    g: foreground.g * alpha + surface.g * (1 - alpha),
    b: foreground.b * alpha + surface.b * (1 - alpha),
    a: 1,
  });
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

interface WeekPanelProps {
  week: number;
  courses: Course[];
  termStart?: string;
  today?: number;
  showDates: boolean;
  showOtherWeekCourses: boolean;
  layout: LayoutInfo;
  colWidth: number;
  headerHeight: number;
  dayLabels: string[];
  cellTheme: ScheduleCellTheme;
  cellBgFor: (courseName: string, isOther: boolean) => string;
  onCoursePress: (
    course: Course,
    conflicts: Course[],
    isOther: boolean,
  ) => void;
  onCourseLongPress: (
    course: Course,
    conflicts: Course[],
    isOther: boolean,
  ) => void;
  onAddSlot: (day: number, sectionStart: number, sectionEnd: number) => void;
}

// 单周课表面板，计算该周的课程分布，冲突列表仅在交互时按需生成。
const WeekPanel = React.memo(function WeekPanel({
  week,
  courses,
  termStart,
  today,
  showDates,
  showOtherWeekCourses,
  layout,
  colWidth,
  headerHeight,
  dayLabels,
  cellTheme,
  cellBgFor,
  onCoursePress,
  onCourseLongPress,
  onAddSlot,
}: WeekPanelProps) {
  const isInWeek = useCallback(
    (c: Course) => c.weekStart <= week && c.weekEnd >= week,
    [week],
  );

  const currentDayCourses = useMemo(
    () => buildDayCourses(courses.filter(isInWeek)),
    [courses, isInWeek],
  );

  const otherDayCoursesAll = useMemo(() => {
    if (!showOtherWeekCourses) return Array.from({ length: 7 }, () => []);
    return buildDayCourses(courses.filter((c) => !isInWeek(c)));
  }, [courses, isInWeek, showOtherWeekCourses]);

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

  // 只为实际交互的课程查找同日重叠项，避免面板挂载时为所有课程做 O(n²) 计算。
  const getConflicts = useCallback(
    (course: Course) => {
      const dayIdx = course.day - 1;
      const allForDay = [
        ...(currentDayCourses[dayIdx] ?? []),
        ...(otherDayCoursesAll[dayIdx] ?? []),
      ];
      const conflicts = allForDay.filter(
        (other) =>
          other.sectionStart <= course.sectionEnd &&
          course.sectionStart <= other.sectionEnd,
      );
      conflicts.sort((a, b) => {
        const aCurrent = isInWeek(a) ? 0 : 1;
        const bCurrent = isInWeek(b) ? 0 : 1;
        if (aCurrent !== bCurrent) return aCurrent - bCurrent;
        return a.weekStart - b.weekStart;
      });
      return conflicts.length > 0 ? conflicts : [course];
    },
    [currentDayCourses, otherDayCoursesAll, isInWeek],
  );

  const dayNumbers = useMemo(
    () => (termStart ? getTermWeekDayNumbers(termStart, week) : null),
    [termStart, week],
  );

  const handlePress = useCallback(
    (course: Course, isOther: boolean) => {
      onCoursePress(course, getConflicts(course), isOther);
    },
    [getConflicts, onCoursePress],
  );

  const handleLongPress = useCallback(
    (course: Course, isOther: boolean) => {
      onCourseLongPress(course, getConflicts(course), isOther);
    },
    [getConflicts, onCourseLongPress],
  );

  return (
    <View style={{ height: "100%", flexDirection: "row" }}>
      {Array.from({ length: 7 }, (_, dayIdx) => (
        <DayColumn
          key={dayIdx}
          dayIdx={dayIdx}
          width={colWidth}
          headerHeight={headerHeight}
          dayLabel={dayLabels[dayIdx]}
          dayNumber={dayNumbers ? dayNumbers[dayIdx] : null}
          isToday={dayIdx + 1 === today}
          showDates={showDates}
          layout={layout}
          theme={cellTheme}
          currentCourses={currentDayCourses[dayIdx]}
          otherCourses={otherDayCoursesVisible[dayIdx]}
          cellBgFor={cellBgFor}
          onCoursePress={handlePress}
          onCourseLongPress={handleLongPress}
          onAddSlot={onAddSlot}
        />
      ))}
    </View>
  );
});

export function Schedule({
  courses,
  week,
  currentWeek,
  today,
  termStart,
  onWeekChange,
}: Readonly<{
  courses: Course[];
  week: number;
  currentWeek: number;
  today?: number;
  termStart?: string;
  onWeekChange?: (week: number) => void;
}>) {
  const localT = useT();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const blurProps = useAppBlurProps();
  const [selected, setSelected] = useState<Course | null>(null);
  const [slotCourses, setSlotCourses] = useState<Course[] | null>(null);
  const [shareName, setShareName] = useState<string | null>(null);
  const [quickAddSlot, setQuickAddSlot] = useState<QuickAddSlot | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const didInitialScroll = useRef(false);
  const pagerRef = useRef<FlatList<number>>(null);
  const [initialWeek] = useState(week);
  const fromPagerRef = useRef(false);
  const selectedWeekRef = useLatest(week);
  const onWeekChangeRef = useLatest(onWeekChange);

  const haptic = useHaptics();
  const scrollWeekend = useScheduleStore((s) => s.scrollWeekend);
  const showMidday = useScheduleStore((s) => s.showMiddaySections);
  const showOtherWeekCourses = useScheduleStore((s) => s.showOtherWeekCourses);
  const colorPalette = useScheduleStore((s) => s.colorPalette);
  const courseColorOverrides = useScheduleStore((s) => s.courseColorOverrides);
  const backgroundImageUri = useScheduleStore((s) => s.backgroundImageUri);
  const courseCellOpacity = useScheduleStore((s) => s.courseCellOpacity);
  const otherWeekCellOpacity = useScheduleStore((s) => s.otherWeekCellOpacity);
  const locatorCellOpacity = useScheduleStore((s) => s.locatorCellOpacity);
  const paletteColors = colorPalette.colors;
  const hasBgImage = !!backgroundImageUri;
  const scheduleSurfaceColor = isDark ? "#000000" : "#ffffff";
  const mutedColor = isDark ? "#a3a3a3" : "#737373";
  const subtleColor = isDark ? "#525252" : "#a3a3a3";
  const primaryTextColor = isDark ? "#e5e5e5" : "#1c1c1e";
  const otherWeekCardColor = isDark ? "#545458" : "#ebebf5";
  const otherWeekAccentColor = isDark ? "#525252" : "#9ca3af";
  const otherWeekTextColor = isDark ? "#d4d4d4" : "#737373";
  const locatorBaseBg = hasBgImage
    ? "rgba(255,255,255,0.08)"
    : isDark
      ? "rgba(255,255,255,0.03)"
      : "rgba(0,0,0,0.02)";
  const locatorBg = withColorOpacity(locatorBaseBg, locatorCellOpacity);
  const otherWeekBg = withColorAlpha(otherWeekCardColor, otherWeekCellOpacity);
  const otherWeekBorderColor = withColorAlpha(otherWeekCardColor, 0.32);

  const dayLabels = useMemo(
    () => WEEKDAY_KEYS.map((key) => localT(key)),
    [localT],
  );
  const monthLabelSuffix = localT("common.monthSuffix");
  const otherWeekTag = localT("schedule.otherWeekTag");

  const layout = useMemo(() => {
    const text: SidebarLabelText = {
      morning: localT("schedule.sidebar.morning"),
      midday: localT("schedule.sidebar.midday"),
      afternoon: localT("schedule.sidebar.afternoon"),
      eveningEarly: localT("schedule.sidebar.eveningEarly"),
      night: localT("schedule.sidebar.night"),
    };
    return showMidday
      ? computeLayout(SECTION_GROUPS_FULL, getSidebarLabelsFull(text))
      : computeLayout(SECTION_GROUPS_COMPACT, getSidebarLabelsCompact(text));
  }, [showMidday, localT]);

  const colorMap = useMemo(
    () => buildColorMap(courses, paletteColors.length),
    [courses, paletteColors.length],
  );

  const isInCurrentWeek = useCallback(
    (c: Course) => c.weekStart <= week && c.weekEnd >= week,
    [week],
  );

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

  const colorOf = useCallback(
    (name: string) =>
      getCourseColor(
        name,
        colorMap,
        paletteColors,
        colorPalette.overrides,
        courseColorOverrides,
      ),
    [colorMap, paletteColors, colorPalette.overrides, courseColorOverrides],
  );

  // 周末模式：首次进入若今天是周末则直接定位到末尾，方便查看周六、周日
  const handleScrollContentSizeChange = useCallback(() => {
    if (!didInitialScroll.current && today && today > 5) {
      didInitialScroll.current = true;
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      });
    }
  }, [today]);

  // 周末模式下切周时把横向滚动重置回周一起点
  const prevWeekRef = useRef(week);
  useEffect(() => {
    if (prevWeekRef.current === week) return;
    prevWeekRef.current = week;
    if (scrollWeekend) {
      scrollViewRef.current?.scrollTo({ x: 0, animated: false });
    }
  }, [week, scrollWeekend]);

  // 非周末模式：外部改变周数时同步分页器位置，用户滑动触发的切周不回弹
  useEffect(() => {
    if (scrollWeekend) {
      fromPagerRef.current = false;
      return;
    }
    if (fromPagerRef.current) {
      fromPagerRef.current = false;
      return;
    }
    pagerRef.current?.scrollToIndex({ index: week - 1, animated: false });
  }, [week, scrollWeekend]);

  const getPagerItemLayout = useCallback(
    (_: ArrayLike<number> | null | undefined, index: number) => ({
      length: availableWidth,
      offset: availableWidth * index,
      index,
    }),
    [availableWidth],
  );

  const onPagerMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (availableWidth <= 0) return;
      const idx = Math.round(e.nativeEvent.contentOffset.x / availableWidth);
      const nextWeek = idx + 1;
      if (nextWeek === selectedWeekRef.current) return;
      const handleWeekChange = onWeekChangeRef.current;
      if (!handleWeekChange) return;
      fromPagerRef.current = true;
      handleWeekChange(nextWeek);
    },
    [availableWidth, onWeekChangeRef, selectedWeekRef],
  );

  const onPagerScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      pagerRef.current?.scrollToOffset({
        offset: info.averageItemLength * info.index,
        animated: false,
      });
    },
    [],
  );

  const showSlotCourses = useCallback((conflicts: Course[]) => {
    setSelected(null);
    setSlotCourses(conflicts);
  }, []);

  const handleCoursePress = useCallback(
    (course: Course, conflicts: Course[], isOther: boolean) => {
      haptic();
      if (isOther) {
        showSlotCourses(conflicts);
        return;
      }
      setSlotCourses(null);
      setSelected(course);
    },
    [haptic, showSlotCourses],
  );

  const handleCourseLongPress = useCallback(
    (_course: Course, conflicts: Course[]) => {
      haptic();
      showSlotCourses(conflicts);
    },
    [haptic, showSlotCourses],
  );

  const handleAddSlot = useCallback(
    (day: number, sectionStart: number, sectionEnd: number) => {
      haptic();
      setQuickAddSlot({ day, sectionStart, sectionEnd });
    },
    [haptic],
  );

  const handleEditCourse = (course: Course) => {
    haptic();
    setSelected(null);
    setSlotCourses(null);
    router.push({
      pathname: "/(pages)/settings/course/add",
      params: { name: course.name },
    });
  };

  const handleShareCourse = (course: Course) => {
    haptic();
    setSelected(null);
    setSlotCourses(null);
    setShareName(course.name);
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

  const cellTheme: ScheduleCellTheme = useMemo(
    () => ({
      nameFontSize,
      roomFontSize,
      otherWeekBorderColor,
      otherWeekTextColor,
      otherWeekTag,
      locatorBg,
      isDark,
      mutedColor,
    }),
    [
      nameFontSize,
      roomFontSize,
      otherWeekBorderColor,
      otherWeekTextColor,
      otherWeekTag,
      locatorBg,
      isDark,
      mutedColor,
    ],
  );

  const cellBgFor = useCallback(
    (courseName: string, isOther: boolean) => {
      if (isOther) return otherWeekBg;
      const courseColor = colorOf(courseName);
      const stableCourseColor = hasBgImage
        ? blendColorOver(courseColor, scheduleSurfaceColor)
        : courseColor;
      return withColorOpacity(stableCourseColor, courseCellOpacity);
    },
    [otherWeekBg, colorOf, hasBgImage, scheduleSurfaceColor, courseCellOpacity],
  );

  const renderPanel = useCallback(
    (panelWeek: number) => (
      <WeekPanel
        week={panelWeek}
        courses={courses}
        termStart={termStart}
        today={panelWeek === currentWeek ? today : undefined}
        showDates={showDates}
        showOtherWeekCourses={showOtherWeekCourses}
        layout={layout}
        colWidth={colWidth}
        headerHeight={headerHeight}
        dayLabels={dayLabels}
        cellTheme={cellTheme}
        cellBgFor={cellBgFor}
        onCoursePress={handleCoursePress}
        onCourseLongPress={handleCourseLongPress}
        onAddSlot={handleAddSlot}
      />
    ),
    [
      courses,
      termStart,
      currentWeek,
      today,
      showDates,
      showOtherWeekCourses,
      layout,
      colWidth,
      headerHeight,
      dayLabels,
      cellTheme,
      cellBgFor,
      handleCoursePress,
      handleCourseLongPress,
      handleAddSlot,
    ],
  );

  const renderPagerItem = useCallback(
    ({ item }: { item: number }) => (
      <View style={{ width: availableWidth, height: "100%" }}>
        {renderPanel(item)}
      </View>
    ),
    [availableWidth, renderPanel],
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

        <View style={{ flex: 1, overflow: "hidden" }}>
          {scrollWeekend ? (
            <ScrollView
              horizontal
              ref={scrollViewRef}
              style={{ flex: 1 }}
              contentContainerStyle={{ flexGrow: 1 }}
              showsHorizontalScrollIndicator={false}
              bounces={false}
              overScrollMode="never"
              onContentSizeChange={handleScrollContentSizeChange}
            >
              {renderPanel(week)}
            </ScrollView>
          ) : (
            <FlatList
              ref={pagerRef}
              data={WEEK_DATA}
              style={styles.fill}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={weekKeyExtractor}
              getItemLayout={getPagerItemLayout}
              initialScrollIndex={initialWeek - 1}
              renderItem={renderPagerItem}
              onMomentumScrollEnd={onPagerMomentumEnd}
              onScrollToIndexFailed={onPagerScrollToIndexFailed}
              windowSize={3}
              initialNumToRender={1}
              maxToRenderPerBatch={1}
              updateCellsBatchingPeriod={16}
              removeClippedSubviews
              bounces={false}
              overScrollMode="never"
              decelerationRate="fast"
            />
          )}
        </View>
      </View>

      <QuickAddCourseModal
        slot={quickAddSlot}
        currentWeek={week}
        onClose={() => setQuickAddSlot(null)}
      />

      <CourseDetailModal
        course={selected}
        headerColor={
          selected
            ? isInCurrentWeek(selected)
              ? colorOf(selected.name)
              : otherWeekAccentColor
            : "transparent"
        }
        showOtherWeekTag={!!selected && !isInCurrentWeek(selected)}
        onClose={() => setSelected(null)}
        onEdit={handleEditCourse}
        onShare={handleShareCourse}
        onAddAtSameSlot={openQuickAddForCourse}
      />

      <CourseShareSheet
        courseName={shareName}
        onClose={() => setShareName(null)}
      />

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
            {...blurProps}
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

              <ScrollView
                style={
                  slotCourses.length > MAX_VISIBLE_SLOT_ROWS
                    ? { height: SLOT_LIST_VISIBLE_HEIGHT }
                    : undefined
                }
                contentContainerStyle={{ padding: SLOT_LIST_PADDING }}
              >
                {slotCourses.map((c, i) => {
                  const other = !isInCurrentWeek(c);
                  const tileColor = other
                    ? otherWeekAccentColor
                    : colorOf(c.name);
                  return (
                    <Pressable
                      key={`${c.name}-${c.weekStart}-${c.sectionStart}-${i}`}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        height: SLOT_ROW_HEIGHT,
                        paddingHorizontal: 12,
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
                      height: SLOT_ROW_HEIGHT,
                      paddingHorizontal: 12,
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
