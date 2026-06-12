import React, { memo } from "react";
import { Pressable, Text, View } from "react-native";

import type { Course } from "@/store/course";

export interface ScheduleLayoutInfo {
  sectionTop: Record<number, number>;
  sectionPct: number;
  groups: number[][];
}

/** 课表格子的静态视觉参数，整体 memo 后作为单一 prop 传入 */
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
  onPress,
}: {
  course: Course;
  isOther: boolean;
  topVal: number;
  heightVal: number;
  bg: string;
  theme: ScheduleCellTheme;
  onPress: (course: Course) => void;
}) {
  const span = course.sectionEnd - course.sectionStart + 1;
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
      onPress={() => onPress(course)}
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
  onCoursePress: (course: Course) => void;
  onAddSlot: (day: number, sectionStart: number, sectionEnd: number) => void;
}) {
  const { isDark, mutedColor } = theme;

  const renderCell = (course: Course, key: string, isOther: boolean) => {
    if (
      layout.sectionTop[course.sectionStart] === undefined ||
      layout.sectionTop[course.sectionEnd] === undefined
    ) {
      return null;
    }
    const topVal = layout.sectionTop[course.sectionStart];
    const heightVal =
      layout.sectionTop[course.sectionEnd] + layout.sectionPct - topVal;

    return (
      <CourseCell
        key={key}
        course={course}
        isOther={isOther}
        topVal={topVal}
        heightVal={heightVal}
        bg={cellBgFor(course.name, isOther)}
        theme={theme}
        onPress={onCoursePress}
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
            `other-${course.name}-${course.sectionStart}-${course.weekStart}-${ci}`,
            true,
          ),
        )}

        {currentCourses.map((course, ci) =>
          renderCell(
            course,
            `cur-${course.name}-${course.sectionStart}-${ci}`,
            false,
          ),
        )}
      </View>
    </View>
  );
});
