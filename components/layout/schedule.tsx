import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { useHaptics } from "@/hooks/use-haptics";
import { getTermWeekDayNumbers, getTermWeekMonthLabel } from "@/lib/date";
import { formatCourseSectionTimeRange } from "@/services/course-time";
import type { Course } from "@/store/course";
import { useScheduleStore } from "@/store/schedule";

export const DAY_LABELS = [
  "周一",
  "周二",
  "周三",
  "周四",
  "周五",
  "周六",
  "周日",
];

interface SidebarLabel {
  label: string;
  firstSection: number;
  lastSection: number;
}

const SECTION_GROUPS_FULL: number[][] = [
  [1, 2],
  [3, 4, 5],
  [6, 7],
  [8, 9, 10, 11, 12],
  [13],
  [14, 15, 16],
];

const SIDEBAR_LABELS_FULL: SidebarLabel[] = [
  { label: "上\n午", firstSection: 1, lastSection: 5 },
  { label: "中\n课", firstSection: 6, lastSection: 7 },
  { label: "下\n午", firstSection: 8, lastSection: 12 },
  { label: "晚\n课", firstSection: 13, lastSection: 13 },
  { label: "晚\n上", firstSection: 14, lastSection: 16 },
];

const SECTION_GROUPS_COMPACT: number[][] = [
  [1, 2],
  [3, 4, 5],
  [8, 9, 10, 11, 12],
  [14, 15, 16],
];

const SIDEBAR_LABELS_COMPACT: SidebarLabel[] = [
  { label: "上\n午", firstSection: 1, lastSection: 5 },
  { label: "下\n午", firstSection: 8, lastSection: 12 },
  { label: "晚\n上", firstSection: 14, lastSection: 16 },
];

const GAP_UNITS = 0;
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
  const numGaps = groups.length - 1;
  const totalUnits = totalSections + numGaps * GAP_UNITS;
  const sectionPct = 100 / totalUnits;
  const gapPct = GAP_UNITS * sectionPct;

  const sectionTop: Record<number, number> = {};
  let y = 0;
  for (let gi = 0; gi < groups.length; gi++) {
    if (gi > 0) y += gapPct;
    for (const sec of groups[gi]) {
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
  const { width: screenWidth } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [selected, setSelected] = useState<Course | null>(null);

  const haptic = useHaptics();
  const scrollWeekend = useScheduleStore((s) => s.scrollWeekend);
  const showMidday = useScheduleStore((s) => s.showMiddaySections);
  const colorPalette = useScheduleStore((s) => s.colorPalette);
  const courseColorOverrides = useScheduleStore((s) => s.courseColorOverrides);
  const backgroundImageUri = useScheduleStore((s) => s.backgroundImageUri);
  const paletteColors = colorPalette.colors;
  const hasBgImage = !!backgroundImageUri;

  const layout = useMemo(
    () =>
      showMidday
        ? computeLayout(SECTION_GROUPS_FULL, SIDEBAR_LABELS_FULL)
        : computeLayout(SECTION_GROUPS_COMPACT, SIDEBAR_LABELS_COMPACT),
    [showMidday],
  );

  const colorMap = useMemo(
    () => buildColorMap(courses, paletteColors.length),
    [courses, paletteColors.length],
  );

  const weekCourses = useMemo(
    () => courses.filter((c) => c.weekStart <= week && c.weekEnd >= week),
    [courses, week],
  );

  const dayCourses = useMemo(() => buildDayCourses(weekCourses), [weekCourses]);

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

  const emptyBg = hasBgImage
    ? "rgba(255,255,255,0.08)"
    : isDark
      ? "rgba(255,255,255,0.03)"
      : "rgba(0,0,0,0.02)";

  const scrollRef = useCallback(
    (node: ScrollView | null) => {
      if (node && today && today > 5) {
        node.scrollToEnd({ animated: false });
      }
    },
    [today],
  );

  const dayColumns = Array.from({ length: 7 }, (_, dayIdx) => {
    const isToday = dayIdx + 1 === today;
    const coursesForDay = dayCourses[dayIdx];

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
                {DAY_LABELS[dayIdx]}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: isToday ? "700" : "500",
                  fontVariant: ["tabular-nums"],
                  color: isToday ? "#fff" : isDark ? "#a3a3a3" : "#737373",
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
              {DAY_LABELS[dayIdx]}
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
                <View
                  style={{
                    flex: 1,
                    margin: 2,
                    backgroundColor: emptyBg,
                    borderRadius: 6,
                  }}
                />
              </View>
            );
          })}

          {coursesForDay
            .filter(
              (c) =>
                layout.sectionTop[c.sectionStart] !== undefined &&
                layout.sectionTop[c.sectionEnd] !== undefined,
            )
            .map((course, ci) => {
              const topVal = layout.sectionTop[course.sectionStart];
              const heightVal =
                layout.sectionTop[course.sectionEnd] +
                layout.sectionPct -
                topVal;
              const bg = getCourseColor(
                course.name,
                colorMap,
                paletteColors,
                colorPalette.overrides,
                courseColorOverrides,
              );
              const span = course.sectionEnd - course.sectionStart + 1;
              const nameLines = 2 * span - 1;

              return (
                <Pressable
                  key={`${course.name}-${course.sectionStart}-${ci}`}
                  style={{
                    position: "absolute",
                    top: pct(topVal),
                    height: pct(heightVal),
                    left: 0,
                    right: 0,
                  }}
                  onPress={() => {
                    haptic();
                    setSelected(course);
                  }}
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
                          color: "#fff",
                          lineHeight: nameFontSize + 4,
                        }}
                      >
                        {course.name}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: roomFontSize,
                        color: "rgba(255,255,255,0.85)",
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      {course.room}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
        </View>
      </View>
    );
  });

  const columnsContent = (
    <View style={{ flexDirection: "row" }}>{dayColumns}</View>
  );

  return (
    <View style={{ flex: 1 }}>
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
                    color: isDark ? "#a3a3a3" : "#737373",
                  }}
                >
                  {monthLabel.split("\n")[0]}
                </Text>
                <Text
                  style={{
                    fontSize: 8,
                    lineHeight: 10,
                    textAlign: "center",
                    color: isDark ? "#a3a3a3" : "#737373",
                  }}
                >
                  月
                </Text>
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
                      color: isDark ? "#a3a3a3" : "#737373",
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

      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <Pressable
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.45)",
          }}
          onPress={() => setSelected(null)}
        >
          {selected && (
            <Pressable
              style={{
                width: 300,
                backgroundColor: isDark ? "#1c1c1e" : "#fff",
                borderRadius: 20,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  backgroundColor: getCourseColor(
                    selected.name,
                    colorMap,
                    paletteColors,
                    colorPalette.overrides,
                    courseColorOverrides,
                  ),
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
                <Text
                  style={{
                    fontSize: 19,
                    fontWeight: "700",
                    color: "#fff",
                    marginRight: 28,
                    lineHeight: 26,
                  }}
                >
                  {selected.name}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: "rgba(255,255,255,0.8)",
                    marginTop: 6,
                  }}
                >
                  {DAY_LABELS[selected.day - 1]} · 第 {selected.sectionStart}-
                  {selected.sectionEnd} 节
                </Text>
              </View>

              <View style={{ padding: 20, gap: 14 }}>
                <DetailRow
                  icon="location-outline"
                  label="教室"
                  value={selected.room}
                  isDark={isDark}
                />
                <DetailRow
                  icon="person-outline"
                  label="教师"
                  value={selected.teacher}
                  isDark={isDark}
                />
                <DetailRow
                  icon="calendar-outline"
                  label="周次"
                  value={`第 ${selected.weekStart}-${selected.weekEnd} 周`}
                  isDark={isDark}
                />
                <DetailRow
                  icon="time-outline"
                  label="时间"
                  value={
                    formatCourseSectionTimeRange(
                      selected.sectionStart,
                      selected.sectionEnd,
                    ) || `第 ${selected.sectionStart}-${selected.sectionEnd} 节`
                  }
                  isDark={isDark}
                />
              </View>
            </Pressable>
          )}
        </Pressable>
      </Modal>
    </View>
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
