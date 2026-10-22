import { Ionicons } from "@expo/vector-icons";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { BlurView } from "expo-blur";
import { useIsFocused, useRouter } from "expo-router";
import React, {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
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
import { logger } from "@/lib/logger";
import {
  buildCurrentWeekCourses,
  buildOtherWeekSchedule,
  buildScheduleLayout,
  buildSchedulePixelLayout,
  getScheduleConflicts,
  indexScheduleCourses,
  type CourseSectionRange,
  type ScheduleLayoutInfo,
  type SchedulePixelLayout,
} from "@/lib/schedule-grid";
import type { Course } from "@/store/course";
import { useScheduleStore } from "@/store/schedule";

import { useAppBlurProps } from "@/components/ui/app-blur-target";
import { CourseDetailModal } from "./course-detail-modal";
import {
  QuickAddCourseModal,
  type QuickAddSlot,
} from "./quick-add-course-modal";
import { DayColumn, type ScheduleCellTheme } from "./schedule-day-column";

const log = logger.extend("Schedule");

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
const FULL_LAYOUT = buildScheduleLayout(SECTION_GROUPS_FULL);
const COMPACT_LAYOUT = buildScheduleLayout(SECTION_GROUPS_COMPACT);

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
const PAGER_CONTENT_POSITION = { disabled: true };
const styles = StyleSheet.create({
  fill: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0 },
});

// 多露出半行，提示列表还可滚动
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

interface WeekPanelProps {
  week: number;
  courseDays: ReturnType<typeof indexScheduleCourses>;
  termStart?: string;
  today?: number;
  showDates: boolean;
  showOtherWeekCourses: boolean;
  layout: ScheduleLayoutInfo;
  pixelLayout: SchedulePixelLayout;
  dayLabels: string[];
  currentTheme: ScheduleCellTheme;
  otherTheme: ScheduleCellTheme;
  locatorBg: string;
  isDark: boolean;
  mutedColor: string;
  courseBackgrounds: ReadonlyMap<string, string>;
  otherWeekBg: string;
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

const WeekPanel = React.memo(function WeekPanel({
  week,
  courseDays,
  termStart,
  today,
  showDates,
  showOtherWeekCourses,
  layout,
  pixelLayout,
  dayLabels,
  currentTheme,
  otherTheme,
  locatorBg,
  isDark,
  mutedColor,
  courseBackgrounds,
  otherWeekBg,
  onCoursePress,
  onCourseLongPress,
  onAddSlot,
}: WeekPanelProps) {
  const currentDays = useMemo(
    () => buildCurrentWeekCourses(courseDays, week),
    [courseDays, week],
  );
  const weekDays = useMemo(
    () =>
      buildOtherWeekSchedule(
        courseDays,
        currentDays,
        week,
        showOtherWeekCourses,
      ),
    [courseDays, currentDays, week, showOtherWeekCourses],
  );
  const weekDaysRef = useLatest(weekDays);

  const getConflicts = useCallback(
    (course: Course, range: CourseSectionRange) => {
      const day = weekDaysRef.current[course.day - 1];
      return day ? getScheduleConflicts(day, course, range, week) : [course];
    },
    [weekDaysRef, week],
  );

  const dayNumbers = useMemo(
    () => (termStart ? getTermWeekDayNumbers(termStart, week) : null),
    [termStart, week],
  );

  const handlePress = useCallback(
    (course: Course, isOther: boolean, range: CourseSectionRange) => {
      onCoursePress(course, getConflicts(course, range), isOther);
    },
    [getConflicts, onCoursePress],
  );

  const handleLongPress = useCallback(
    (course: Course, isOther: boolean, range: CourseSectionRange) => {
      onCourseLongPress(course, getConflicts(course, range), isOther);
    },
    [getConflicts, onCourseLongPress],
  );

  return (
    <View style={{ width: pixelLayout.width, height: pixelLayout.height }}>
      {Array.from({ length: 7 }, (_, dayIdx) => (
        <DayColumn
          key={dayIdx}
          dayIdx={dayIdx}
          pixelLayout={pixelLayout}
          dayLabel={dayLabels[dayIdx]}
          dayNumber={dayNumbers ? dayNumbers[dayIdx] : null}
          isToday={dayIdx + 1 === today}
          showDates={showDates}
          layout={layout}
          currentTheme={currentTheme}
          otherTheme={otherTheme}
          locatorBg={locatorBg}
          isDark={isDark}
          mutedColor={mutedColor}
          currentCourses={currentDays[dayIdx]}
          otherCourses={weekDays[dayIdx].visibleOther}
          courseBackgrounds={courseBackgrounds}
          otherWeekBg={otherWeekBg}
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
  onReady,
}: Readonly<{
  courses: Course[];
  week: number;
  currentWeek: number;
  today?: number;
  termStart?: string;
  onWeekChange?: (week: number) => void;
  onReady?: () => void;
}>) {
  const isFocused = useIsFocused();
  const localT = useT();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const blurProps = useAppBlurProps();
  const [selected, setSelected] = useState<Course | null>(null);
  const [slotCourses, setSlotCourses] = useState<Course[] | null>(null);
  const [shareName, setShareName] = useState<string | null>(null);
  const [quickAddSlot, setQuickAddSlot] = useState<QuickAddSlot | null>(null);

  const scrollViewRef = useRef<ScrollViewInstance>(null);
  const didInitialScroll = useRef(false);
  const weekendFrameRef = useRef<number | null>(null);
  const weekendContentWidthRef = useRef(0);
  const pagerRef = useRef<FlashListRef<number>>(null);
  const pagerLoadedRef = useRef(false);
  const pagerVisibleRef = useRef(false);
  const nativePagerOffsetRef = useRef(0);
  const pagerFrameRef = useRef<number | null>(null);
  const [pagerReady, setPagerReady] = useState(false);
  const [preloadWeeks, setPreloadWeeks] = useState(false);
  const commitTimeRef = useRef<number | null>(null);
  const firstLayoutTimeRef = useRef<number | null>(null);
  const [pagerSize, setPagerSize] = useState({ width: 0, height: 0 });
  const pagerSizeRef = useRef(pagerSize);
  const fromPagerRef = useRef(false);
  const selectedWeekRef = useLatest(week);
  const onWeekChangeRef = useLatest(onWeekChange);
  const onReadyRef = useLatest(onReady);

  useLayoutEffect(() => {
    commitTimeRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!pagerReady || !isFocused) return;
    startTransition(() => setPreloadWeeks(true));
  }, [pagerReady, isFocused]);

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

  const layout = showMidday ? FULL_LAYOUT : COMPACT_LAYOUT;
  const sidebarLabels = useMemo(() => {
    const text: SidebarLabelText = {
      morning: localT("schedule.sidebar.morning"),
      midday: localT("schedule.sidebar.midday"),
      afternoon: localT("schedule.sidebar.afternoon"),
      eveningEarly: localT("schedule.sidebar.eveningEarly"),
      night: localT("schedule.sidebar.night"),
    };
    return showMidday
      ? getSidebarLabelsFull(text)
      : getSidebarLabelsCompact(text);
  }, [showMidday, localT]);

  const colorMap = useMemo(
    () => buildColorMap(courses, paletteColors.length),
    [courses, paletteColors.length],
  );
  const courseDays = useMemo(() => indexScheduleCourses(courses), [courses]);

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
  const availableWidth = pagerSize.width;
  const colWidth = scrollWeekend
    ? (availableWidth - PEEK_WIDTH) / visibleCols
    : availableWidth / visibleCols;
  const pixelLayout = useMemo(
    () =>
      buildSchedulePixelLayout(
        layout,
        colWidth,
        pagerSize.height,
        headerHeight,
      ),
    [layout, colWidth, pagerSize.height, headerHeight],
  );

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

  const setWeekendScrollRef = useCallback(
    (instance: ScrollViewInstance | null) => {
      if (scrollViewRef.current === instance) return;
      scrollViewRef.current = instance;
      weekendContentWidthRef.current = 0;
      didInitialScroll.current = false;
      if (weekendFrameRef.current !== null) {
        cancelAnimationFrame(weekendFrameRef.current);
        weekendFrameRef.current = null;
      }
    },
    [],
  );

  const handleScrollContentSizeChange = useCallback(
    (width?: number) => {
      if (width !== undefined) weekendContentWidthRef.current = width;
      onReadyRef.current?.();
      if (didInitialScroll.current || weekendFrameRef.current !== null) return;
      if (colWidth <= 0 || weekendContentWidthRef.current < colWidth * 7 - 1)
        return;
      const scrollView = scrollViewRef.current;
      if (!scrollView) return;
      weekendFrameRef.current = requestAnimationFrame(() => {
        weekendFrameRef.current = null;
        if (scrollViewRef.current !== scrollView) return;
        didInitialScroll.current = true;
        if (week === currentWeek && today && today > 5) {
          scrollView.scrollToEnd({ animated: false });
        } else {
          scrollView.scrollTo({ x: 0, animated: false });
        }
      });
    },
    [week, currentWeek, today, colWidth, onReadyRef],
  );

  useLayoutEffect(() => {
    didInitialScroll.current = false;
    if (scrollWeekend) handleScrollContentSizeChange();
    return () => {
      if (weekendFrameRef.current !== null) {
        cancelAnimationFrame(weekendFrameRef.current);
        weekendFrameRef.current = null;
      }
    };
  }, [scrollWeekend, handleScrollContentSizeChange]);

  const handlePagerLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    const previousSize = pagerSizeRef.current;
    if (previousSize.width === width && previousSize.height === height) return;
    pagerSizeRef.current = { width, height };
    if (previousSize.height > 0) {
      log.debug("container resized", {
        previous: previousSize,
        current: { width, height },
      });
    }
    if (firstLayoutTimeRef.current === null) {
      firstLayoutTimeRef.current = Date.now();
      log.debug("container ready", {
        sinceCommitInMs:
          commitTimeRef.current === null
            ? null
            : firstLayoutTimeRef.current - commitTimeRef.current,
        width,
        height,
      });
    }
    setPagerSize((previous) =>
      previous.width === width && previous.height === height
        ? previous
        : { width, height },
    );
  }, []);

  const setPagerRef = useCallback((instance: FlashListRef<number> | null) => {
    if (pagerRef.current !== instance) {
      if (pagerFrameRef.current !== null) {
        cancelAnimationFrame(pagerFrameRef.current);
        pagerFrameRef.current = null;
      }
      pagerLoadedRef.current = false;
      pagerVisibleRef.current = false;
      nativePagerOffsetRef.current = 0;
      pagerRef.current = instance;
      if (instance === null) {
        setPagerReady(false);
        setPreloadWeeks(false);
      }
    }
  }, []);

  const revealPagerIfAligned = useCallback(() => {
    if (!pagerLoadedRef.current || pagerVisibleRef.current) return;
    const { width, height } = pagerSizeRef.current;
    const index = selectedWeekRef.current - 1;
    const cell = pagerRef.current?.getLayout(index);
    const offset = index * width;
    if (
      !cell ||
      width <= 0 ||
      Math.abs(cell.width - width) > 1 ||
      Math.abs(cell.height - height) > 1 ||
      Math.abs(cell.x - offset) > 1 ||
      Math.abs(nativePagerOffsetRef.current - offset) > 1
    )
      return;
    pagerVisibleRef.current = true;
    log.debug("pager visible", {
      sinceCommitInMs:
        commitTimeRef.current === null
          ? null
          : Date.now() - commitTimeRef.current,
      week: selectedWeekRef.current,
    });
    setPagerReady(true);
    onReadyRef.current?.();
  }, [selectedWeekRef, onReadyRef]);

  const syncPagerWeek = useCallback(() => {
    const pager = pagerRef.current;
    if (!pager || !pagerLoadedRef.current || pagerSizeRef.current.width <= 0)
      return;
    const offset = (selectedWeekRef.current - 1) * pagerSizeRef.current.width;
    if (Math.abs(pager.getAbsoluteLastScrollOffset() - offset) > 1) {
      pager.scrollToOffset({ offset, animated: false });
    }
    if (pagerVisibleRef.current || pagerFrameRef.current !== null) return;

    let attempts = 0;
    let alignedFrames = 0;
    // 连续两帧对齐后显示以兼容缺少原生滚动事件的初始化
    const checkAlignment = () => {
      pagerFrameRef.current = null;
      if (pagerRef.current !== pager || pagerVisibleRef.current) return;
      const { width, height } = pagerSizeRef.current;
      const index = selectedWeekRef.current - 1;
      const targetOffset = index * width;
      const cell = pager.getLayout(index);
      const offset = pager.getAbsoluteLastScrollOffset();
      const aligned =
        !!cell &&
        width > 0 &&
        height > 0 &&
        Math.abs(cell.width - width) <= 1 &&
        Math.abs(cell.height - height) <= 1 &&
        Math.abs(cell.x - targetOffset) <= 1 &&
        Math.abs(offset - targetOffset) <= 1;
      alignedFrames = aligned ? alignedFrames + 1 : 0;
      if (alignedFrames >= 2) {
        nativePagerOffsetRef.current = offset;
        revealPagerIfAligned();
        return;
      }
      if (++attempts < 30) {
        pagerFrameRef.current = requestAnimationFrame(checkAlignment);
      } else {
        log.warn("pager alignment pending", {
          week: selectedWeekRef.current,
          width,
          height,
        });
      }
    };
    pagerFrameRef.current = requestAnimationFrame(checkAlignment);
  }, [selectedWeekRef, revealPagerIfAligned]);

  useEffect(
    () => () => {
      if (pagerFrameRef.current !== null) {
        cancelAnimationFrame(pagerFrameRef.current);
      }
    },
    [],
  );

  const handlePagerScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      nativePagerOffsetRef.current = event.nativeEvent.contentOffset.x;
      revealPagerIfAligned();
    },
    [revealPagerIfAligned],
  );

  const handlePagerContentSizeChange = useCallback(() => {
    if (!pagerVisibleRef.current) syncPagerWeek();
  }, [syncPagerWeek]);

  const handlePagerLoaded = useCallback(
    ({ elapsedTimeInMs }: { elapsedTimeInMs: number }) => {
      pagerLoadedRef.current = true;
      log.debug("pager loaded", {
        elapsedTimeInMs,
        sinceCommitInMs:
          commitTimeRef.current === null
            ? null
            : Date.now() - commitTimeRef.current,
        sinceContainerReadyInMs:
          firstLayoutTimeRef.current === null
            ? null
            : Date.now() - firstLayoutTimeRef.current,
        week: selectedWeekRef.current,
      });
      revealPagerIfAligned();
      syncPagerWeek();
    },
    [selectedWeekRef, revealPagerIfAligned, syncPagerWeek],
  );

  // 跳过手势切周后的程序定位，避免分页回弹
  useLayoutEffect(() => {
    if (scrollWeekend) {
      fromPagerRef.current = false;
      return;
    }
    if (fromPagerRef.current) {
      fromPagerRef.current = false;
      return;
    }
    syncPagerWeek();
  }, [
    week,
    scrollWeekend,
    pagerSize.width,
    pagerSize.height,
    isFocused,
    syncPagerWeek,
  ]);

  const onPagerMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (availableWidth <= 0) return;
      const idx = Math.round(e.nativeEvent.contentOffset.x / availableWidth);
      const nextWeek = Math.max(1, Math.min(MAX_WEEK, idx + 1));
      if (nextWeek === selectedWeekRef.current) return;
      const handleWeekChange = onWeekChangeRef.current;
      if (!handleWeekChange) return;
      fromPagerRef.current = true;
      handleWeekChange(nextWeek);
    },
    [availableWidth, onWeekChangeRef, selectedWeekRef],
  );

  const showSlotCourses = useCallback((conflicts: Course[]) => {
    setSelected(null);
    setSlotCourses(conflicts);
  }, []);

  const handleCoursePress = useCallback(
    (course: Course, conflicts: Course[], isOther: boolean) => {
      haptic();
      // 点击时读取周次，保持缓存页面的回调稳定
      const selectedWeek = selectedWeekRef.current;
      if (
        isOther ||
        conflicts.filter(
          (c) => c.weekStart <= selectedWeek && c.weekEnd >= selectedWeek,
        ).length > 1
      ) {
        showSlotCourses(conflicts);
        return;
      }
      setSlotCourses(null);
      setSelected(course);
    },
    [haptic, showSlotCourses, selectedWeekRef],
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
    // 使用完整分组，兼容紧凑模式隐藏的节次
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

  const currentTheme: ScheduleCellTheme = useMemo(
    () => ({
      nameFontSize,
      roomFontSize,
      borderColor: "transparent",
      nameColor: "#fff",
      roomColor: "rgba(255,255,255,0.85)",
      tag: "",
    }),
    [nameFontSize, roomFontSize],
  );
  const otherTheme: ScheduleCellTheme = useMemo(
    () => ({
      nameFontSize,
      roomFontSize,
      borderColor: otherWeekBorderColor,
      nameColor: otherWeekTextColor,
      roomColor: otherWeekTextColor,
      tag: otherWeekTag,
    }),
    [
      nameFontSize,
      roomFontSize,
      otherWeekBorderColor,
      otherWeekTextColor,
      otherWeekTag,
    ],
  );

  const courseBackgrounds = useMemo(() => {
    const backgrounds = new Map<string, string>();
    for (const course of courses) {
      if (backgrounds.has(course.name)) continue;
      const courseColor = colorOf(course.name);
      const stableCourseColor = hasBgImage
        ? blendColorOver(courseColor, scheduleSurfaceColor)
        : courseColor;
      backgrounds.set(
        course.name,
        withColorOpacity(stableCourseColor, courseCellOpacity),
      );
    }
    return backgrounds;
  }, [courses, colorOf, hasBgImage, scheduleSurfaceColor, courseCellOpacity]);

  const renderPanel = useCallback(
    (panelWeek: number) => (
      <WeekPanel
        week={panelWeek}
        courseDays={courseDays}
        termStart={termStart}
        today={panelWeek === currentWeek ? today : undefined}
        showDates={showDates}
        showOtherWeekCourses={showOtherWeekCourses}
        layout={layout}
        pixelLayout={pixelLayout}
        dayLabels={dayLabels}
        currentTheme={currentTheme}
        otherTheme={otherTheme}
        locatorBg={locatorBg}
        isDark={isDark}
        mutedColor={mutedColor}
        courseBackgrounds={courseBackgrounds}
        otherWeekBg={otherWeekBg}
        onCoursePress={handleCoursePress}
        onCourseLongPress={handleCourseLongPress}
        onAddSlot={handleAddSlot}
      />
    ),
    [
      courseDays,
      termStart,
      currentWeek,
      today,
      showDates,
      showOtherWeekCourses,
      layout,
      pixelLayout,
      dayLabels,
      currentTheme,
      otherTheme,
      locatorBg,
      isDark,
      mutedColor,
      courseBackgrounds,
      otherWeekBg,
      handleCoursePress,
      handleCourseLongPress,
      handleAddSlot,
    ],
  );

  const renderInitialPagerItem = useCallback(
    ({ item }: { item: number }) => (
      <View
        style={{ width: availableWidth, height: pagerSize.height }}
        onLayout={pagerReady ? undefined : syncPagerWeek}
      >
        {/* 首屏只构建当前周，其他周先用等尺寸容器参与测量 */}
        {item === week ? renderPanel(item) : null}
      </View>
    ),
    [
      availableWidth,
      pagerSize.height,
      renderPanel,
      week,
      pagerReady,
      syncPagerWeek,
    ],
  );
  const renderReadyPagerItem = useCallback(
    ({ item }: { item: number }) => (
      <View style={{ width: availableWidth, height: pagerSize.height }}>
        {renderPanel(item)}
      </View>
    ),
    [availableWidth, pagerSize.height, renderPanel],
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
            {sidebarLabels.map((sl) => {
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

        <View
          style={{ flex: 1, minHeight: 0, overflow: "hidden" }}
          onLayout={handlePagerLayout}
        >
          {pagerSize.width <= 0 ||
          pagerSize.height <= 0 ? null : scrollWeekend ? (
            <ScrollView
              horizontal
              ref={setWeekendScrollRef}
              // 周末模式只滚动星期列，切周由顶部控件处理。
              // 列表不参与容器高度计算，避免内容测量反过来撑大网格
              style={styles.fill}
              contentContainerStyle={{
                flexGrow: 1,
                height: pagerSize.height,
              }}
              showsHorizontalScrollIndicator={false}
              contentInsetAdjustmentBehavior="never"
              bounces={false}
              overScrollMode="never"
              onContentSizeChange={handleScrollContentSizeChange}
            >
              {renderPanel(week)}
            </ScrollView>
          ) : (
            <FlashList
              ref={setPagerRef}
              data={WEEK_DATA}
              style={[styles.fill, { opacity: pagerReady ? 1 : 0 }]}
              // 固定横向内容高度，避免测量时被估算高度撑开
              contentContainerStyle={{ height: pagerSize.height }}
              horizontal
              contentInsetAdjustmentBehavior="never"
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={weekKeyExtractor}
              initialScrollIndex={week - 1}
              renderItem={
                preloadWeeks ? renderReadyPagerItem : renderInitialPagerItem
              }
              onLoad={handlePagerLoaded}
              onScroll={pagerReady ? undefined : handlePagerScroll}
              scrollEventThrottle={16}
              onContentSizeChange={handlePagerContentSizeChange}
              onMomentumScrollEnd={onPagerMomentumEnd}
              drawDistance={preloadWeeks ? availableWidth : 0}
              maintainVisibleContentPosition={PAGER_CONTENT_POSITION}
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
