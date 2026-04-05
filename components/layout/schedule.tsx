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

const ALL_SECTIONS: { flex: number }[] = [
  { flex: 2 }, // 0 早上 A: DM 1-2
  { flex: 3 }, // 1 早上 B: DM 3-5
  { flex: 2 }, // 2 中午:   DM 6-7
  { flex: 3 }, // 3 下午 A: DM 8-10
  { flex: 2 }, // 4 下午 B: DM 11-12
  { flex: 4 }, // 5 晚上:   DM 13-16
];

const ALL_SIDEBAR_GROUPS = [
  { label: "早\n上", flex: 5 },
  { label: "中\n午", flex: 2 },
  { label: "下\n午", flex: 5 },
  { label: "晚\n上", flex: 4 },
];

const NOON_SECTION_INDEX = 2;
const NOON_SIDEBAR_INDEX = 1;

export const COURSE_COLORS = [
  "rgba(91,155,213,0.75)",
  "rgba(112,173,71,0.75)",
  "rgba(237,125,49,0.75)",
  "rgba(168,85,247,0.75)",
  "rgba(236,72,153,0.75)",
  "rgba(20,184,166,0.75)",
  "rgba(245,158,11,0.75)",
  "rgba(99,102,241,0.75)",
];

const SECTION_MAP: Record<number, number> = {
  1: 0,
  2: 0,
  3: 1,
  4: 1,
  5: 1,
  6: 2,
  7: 2,
  8: 3,
  9: 3,
  10: 3,
  11: 4,
  12: 4,
  13: 5,
  14: 5,
  15: 5,
  16: 5,
};

function buildColorMap(courses: Course[]): Map<string, number> {
  const map = new Map<string, number>();
  let idx = 0;
  for (const c of courses) {
    if (!map.has(c.name)) {
      map.set(c.name, idx % COURSE_COLORS.length);
      idx++;
    }
  }
  return map;
}

function buildGrid(
  courses: Course[],
  sectionCount: number,
): (Course | null)[][] {
  const table: Course[][][] = Array.from({ length: 7 }, () =>
    Array.from({ length: sectionCount }, () => []),
  );
  for (const c of courses) {
    const d = c.day - 1;
    const s = SECTION_MAP[c.sectionStart];
    if (d >= 0 && d < 7 && s !== undefined && s < sectionCount) {
      table[d][s].push(c);
    }
  }
  return table.map((day) => day.map((cell) => cell[0] ?? null));
}

const HEADER_HEIGHT = 36;
const SIDEBAR_WIDTH = 24;
const PEEK_WIDTH = 20;

export function Schedule({
  courses,
  week,
  today,
}: Readonly<{
  courses: Course[];
  week: number;
  today?: number;
}>) {
  const { width: screenWidth } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [selected, setSelected] = useState<Course | null>(null);

  const haptic = useHaptics();
  const scrollWeekend = useScheduleStore((s) => s.scrollWeekend);
  const showNoonCourse = useScheduleStore((s) => s.showNoonCourse);

  const sections = useMemo(
    () =>
      showNoonCourse
        ? ALL_SECTIONS
        : ALL_SECTIONS.filter((_, i) => i !== NOON_SECTION_INDEX),
    [showNoonCourse],
  );

  const sidebarGroups = useMemo(
    () =>
      showNoonCourse
        ? ALL_SIDEBAR_GROUPS
        : ALL_SIDEBAR_GROUPS.filter((_, i) => i !== NOON_SIDEBAR_INDEX),
    [showNoonCourse],
  );

  const sectionIndices = useMemo(
    () =>
      showNoonCourse
        ? ALL_SECTIONS.map((_, i) => i)
        : ALL_SECTIONS.map((_, i) => i).filter((i) => i !== NOON_SECTION_INDEX),
    [showNoonCourse],
  );

  const colorMap = useMemo(() => buildColorMap(courses), [courses]);

  const weekCourses = useMemo(
    () => courses.filter((c) => c.weekStart <= week && c.weekEnd >= week),
    [courses, week],
  );

  const grid = useMemo(
    () => buildGrid(weekCourses, ALL_SECTIONS.length),
    [weekCourses],
  );

  const visibleCols = scrollWeekend ? 5 : 7;
  const availableWidth = screenWidth - SIDEBAR_WIDTH;
  const colWidth = scrollWeekend
    ? (availableWidth - PEEK_WIDTH) / visibleCols
    : availableWidth / visibleCols;

  const nameFontSize = scrollWeekend ? 12 : 10;
  const roomFontSize = scrollWeekend ? 10 : 9;

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
    return (
      <View key={dayIdx} style={{ width: colWidth }}>
        <View
          style={{
            height: HEADER_HEIGHT,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: isToday ? "800" : "600",
              color: isToday ? "#3b82f6" : isDark ? "#d4d4d4" : "#525252",
            }}
          >
            {DAY_LABELS[dayIdx]}
          </Text>
        </View>

        {sectionIndices.map((secIdx, renderIdx) => {
          const course = grid[dayIdx][secIdx];
          const bg = course
            ? COURSE_COLORS[colorMap.get(course.name) ?? 0]
            : undefined;

          return (
            <View
              key={secIdx}
              style={{ flex: sections[renderIdx].flex, padding: 2 }}
            >
              {course ? (
                <Pressable
                  style={{
                    flex: 1,
                    backgroundColor: bg,
                    borderRadius: 6,
                    padding: 4,
                    overflow: "hidden",
                    flexDirection: "column",
                  }}
                  onPress={() => {
                    haptic();
                    setSelected(course);
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
                      marginTop: 6,
                    }}
                  >
                    {course.room}
                  </Text>
                </Pressable>
              ) : (
                <View
                  style={{
                    flex: 1,
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.03)"
                      : "rgba(0,0,0,0.02)",
                    borderRadius: 6,
                  }}
                />
              )}
            </View>
          );
        })}
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
          <View style={{ height: HEADER_HEIGHT }} />
          {sidebarGroups.map((g) => (
            <View
              key={g.label}
              style={{
                flex: g.flex,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  color: isDark ? "#737373" : "#a3a3a3",
                  textAlign: "center",
                  lineHeight: 16,
                }}
              >
                {g.label}
              </Text>
            </View>
          ))}
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
                  backgroundColor:
                    COURSE_COLORS[colorMap.get(selected.name) ?? 0],
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
                  label="节次"
                  value={`第 ${selected.sectionStart}-${selected.sectionEnd} 节`}
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
