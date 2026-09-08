import { useMappingHelper } from "@shopify/flash-list";
import React, { memo, useMemo } from "react";
import { Pressable, Text, View } from "react-native";

import type { Course } from "@/store/course";

export type CourseSectionRange = Pick<Course, "sectionStart" | "sectionEnd">;

export interface ScheduleLayoutInfo {
  sectionTop: Record<number, number>;
  sectionPct: number;
  groups: number[][];
}

export interface ScheduleCellTheme {
  nameFontSize: number;
  roomFontSize: number;
  otherWeekBorderColor: string;
  otherWeekTextColor: string;
  otherWeekTag: string;
  locatorBg: string;
  isDark: boolean;
  mutedColor: string;
}

function pct(n: number): `${number}%` {
  return `${n}%` as `${number}%`;
}

const CourseCell = memo(function CourseCell({
  course,
  isOther,
  topVal,
  heightVal,
  bg,
  theme,
  stackCount = 1,
  sectionRange,
  onPress,
  onLongPress,
}: {
  course: Course;
  isOther: boolean;
  topVal: number;
  heightVal: number;
  bg: string;
  theme: ScheduleCellTheme;
  stackCount?: number;
  sectionRange: CourseSectionRange;
  onPress: (
    course: Course,
    isOther: boolean,
    range: CourseSectionRange,
  ) => void;
  onLongPress: (
    course: Course,
    isOther: boolean,
    range: CourseSectionRange,
  ) => void;
}) {
  const span = sectionRange.sectionEnd - sectionRange.sectionStart + 1;
  const nameLines = 2 * span - 1;
  const nameColor = isOther ? theme.otherWeekTextColor : "#fff";
  const roomColor = isOther
    ? theme.otherWeekTextColor
    : "rgba(255,255,255,0.85)";

  return (
    <Pressable
      style={{
        position: "absolute",
        top: pct(topVal),
        height: pct(heightVal),
        left: 0,
        right: 0,
      }}
      onPress={() => onPress(course, isOther, sectionRange)}
      onLongPress={() => onLongPress(course, isOther, sectionRange)}
    >
      <View
        style={{
          flex: 1,
          margin: 2,
          backgroundColor: bg,
          borderWidth: isOther ? 1 : 0,
          borderColor: isOther ? theme.otherWeekBorderColor : "transparent",
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
              fontSize: theme.nameFontSize,
              fontWeight: "bold",
              color: nameColor,
              lineHeight: theme.nameFontSize + 4,
            }}
          >
            {course.name}
          </Text>
          {isOther && (
            <Text
              style={{
                fontSize: theme.roomFontSize,
                color: roomColor,
              }}
            >
              {theme.otherWeekTag}
            </Text>
          )}
        </View>
        <Text
          style={{
            fontSize: theme.roomFontSize,
            color: roomColor,
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          {course.room}
        </Text>
        {stackCount > 1 && (
          <View
            style={{
              position: "absolute",
              top: 3,
              right: 3,
              minWidth: 15,
              height: 15,
              borderRadius: 8,
              paddingHorizontal: 3,
              backgroundColor: "rgba(0,0,0,0.35)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 9, fontWeight: "700", color: "#fff" }}>
              {stackCount}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
});

export const DayColumn = memo(function DayColumn({
  dayIdx,
  width,
  headerHeight,
  dayLabel,
  dayNumber,
  isToday,
  showDates,
  layout,
  theme,
  currentCourses,
  otherCourses,
  cellBgFor,
  onCoursePress,
  onCourseLongPress,
  onAddSlot,
}: {
  dayIdx: number;
  width: number;
  headerHeight: number;
  dayLabel: string;
  dayNumber: number | null;
  isToday: boolean;
  showDates: boolean;
  layout: ScheduleLayoutInfo;
  theme: ScheduleCellTheme;
  currentCourses: Course[];
  otherCourses: Course[];
  cellBgFor: (courseName: string, isOther: boolean) => string;
  onCoursePress: (
    course: Course,
    isOther: boolean,
    range: CourseSectionRange,
  ) => void;
  onCourseLongPress: (
    course: Course,
    isOther: boolean,
    range: CourseSectionRange,
  ) => void;
  onAddSlot: (day: number, sectionStart: number, sectionEnd: number) => void;
}) {
  const { isDark, mutedColor } = theme;
  const { getMappingKey } = useMappingHelper();

  const currentGroups = useMemo(() => {
    const visibleSections = layout.groups.flat();
    const entries = currentCourses.flatMap((course) => {
      const sections = visibleSections.filter(
        (section) =>
          section >= course.sectionStart && section <= course.sectionEnd,
      );
      if (sections.length === 0) return [];
      return [
        {
          course,
          count: 1,
          sectionStart: Math.min(...sections),
          sectionEnd: Math.max(...sections),
        },
      ];
    });
    entries.sort((a, b) => a.sectionStart - b.sectionStart);

    const groups: typeof entries = [];
    for (const entry of entries) {
      const previous = groups[groups.length - 1];
      if (previous && entry.sectionStart <= previous.sectionEnd) {
        previous.sectionEnd = Math.max(previous.sectionEnd, entry.sectionEnd);
        previous.count++;
      } else {
        groups.push(entry);
      }
    }
    return groups;
  }, [currentCourses, layout.groups]);

  const renderCell = (
    course: Course,
    key: string,
    isOther: boolean,
    stackCount = 1,
    sectionRange: CourseSectionRange = course,
  ) => {
    // 紧凑模式隐藏 6、7、13 节，跨越这些节次的课程仍需显示可见部分。
    let start = sectionRange.sectionStart;
    let end = sectionRange.sectionEnd;
    while (start <= end && layout.sectionTop[start] === undefined) start++;
    while (end >= start && layout.sectionTop[end] === undefined) end--;
    if (start > end) return null;

    const topVal = layout.sectionTop[start];
    const heightVal = layout.sectionTop[end] + layout.sectionPct - topVal;

    return (
      <CourseCell
        key={key}
        course={course}
        isOther={isOther}
        topVal={topVal}
        heightVal={heightVal}
        bg={cellBgFor(course.name, isOther)}
        theme={theme}
        stackCount={stackCount}
        sectionRange={sectionRange}
        onPress={onCoursePress}
        onLongPress={onCourseLongPress}
      />
    );
  };

  return (
    <View style={{ width }}>
      <View
        style={{
          height: headerHeight,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {showDates && dayNumber !== null ? (
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
              {dayLabel}
            </Text>
            <Text
              style={{
                fontSize: 11,
                fontWeight: isToday ? "700" : "500",
                fontVariant: ["tabular-nums"],
                color: isToday ? "#fff" : mutedColor,
              }}
            >
              {dayNumber}
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
            {dayLabel}
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
                  backgroundColor: theme.locatorBg,
                  borderRadius: 6,
                  opacity: pressed ? 0.6 : 1,
                })}
                onPress={() => onAddSlot(dayIdx + 1, sectionStart, sectionEnd)}
              />
            </View>
          );
        })}

        {otherCourses.map((course, ci) =>
          renderCell(
            course,
            `other-${getMappingKey(`${course.name}-${course.sectionStart}-${course.weekStart}-${ci}`, ci)}`,
            true,
          ),
        )}

        {currentGroups.map((group, ci) =>
          renderCell(
            group.course,
            `cur-${getMappingKey(group.sectionStart, ci)}`,
            false,
            group.count,
            group,
          ),
        )}
      </View>
    </View>
  );
});
