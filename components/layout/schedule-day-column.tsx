import { useMappingHelper } from "@shopify/flash-list";
import { memo, useMemo } from "react";
import { Pressable, Text, View } from "react-native";

import {
  buildCurrentScheduleCells,
  buildOtherScheduleCells,
  getScheduleCellRect,
  type CourseSectionRange,
  type ScheduleCourseCell,
  type ScheduleLayoutInfo,
  type SchedulePixelLayout,
  type ScheduleRect,
} from "@/lib/schedule-grid";
import type { Course } from "@/store/course";

export interface ScheduleCellTheme {
  nameFontSize: number;
  roomFontSize: number;
  borderColor: string;
  nameColor: string;
  roomColor: string;
  tag: string;
}

const CourseCell = memo(function CourseCell({
  course,
  isOther,
  rect,
  bg,
  theme,
  stackCount = 1,
  sectionRange,
  onPress,
  onLongPress,
}: {
  course: Course;
  isOther: boolean;
  rect: ScheduleRect;
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

  return (
    <Pressable
      style={{
        position: "absolute",
        ...rect,
        backgroundColor: bg,
        borderWidth: isOther ? 1 : 0,
        borderColor: theme.borderColor,
        borderRadius: 6,
        padding: 4,
        overflow: "hidden",
        flexDirection: "column",
      }}
      onPress={() => onPress(course, isOther, sectionRange)}
      onLongPress={() => onLongPress(course, isOther, sectionRange)}
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
            color: theme.nameColor,
            lineHeight: theme.nameFontSize + 4,
          }}
        >
          {course.name}
        </Text>
        {isOther && (
          <Text
            style={{
              fontSize: theme.roomFontSize,
              color: theme.roomColor,
            }}
          >
            {theme.tag}
          </Text>
        )}
      </View>
      <Text
        style={{
          fontSize: theme.roomFontSize,
          color: theme.roomColor,
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
    </Pressable>
  );
});

export const DayColumn = memo(function DayColumn({
  dayIdx,
  pixelLayout,
  dayLabel,
  dayNumber,
  isToday,
  showDates,
  layout,
  currentTheme,
  otherTheme,
  locatorBg,
  isDark,
  mutedColor,
  currentCourses,
  otherCourses,
  courseBackgrounds,
  otherWeekBg,
  onCoursePress,
  onCourseLongPress,
  onAddSlot,
}: {
  dayIdx: number;
  pixelLayout: SchedulePixelLayout;
  dayLabel: string;
  dayNumber: number | null;
  isToday: boolean;
  showDates: boolean;
  layout: ScheduleLayoutInfo;
  currentTheme: ScheduleCellTheme;
  otherTheme: ScheduleCellTheme;
  locatorBg: string;
  isDark: boolean;
  mutedColor: string;
  currentCourses: Course[];
  otherCourses: Course[];
  courseBackgrounds: ReadonlyMap<string, string>;
  otherWeekBg: string;
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
  const { getMappingKey } = useMappingHelper();

  const currentCells = useMemo(
    () => buildCurrentScheduleCells(currentCourses, layout),
    [currentCourses, layout],
  );
  const otherCells = useMemo(
    () => buildOtherScheduleCells(otherCourses, layout),
    [otherCourses, layout],
  );
  const positionedCurrentCells = useMemo(
    () =>
      currentCells.map((cell) => ({
        ...cell,
        rect: getScheduleCellRect(cell, pixelLayout),
      })),
    [currentCells, pixelLayout],
  );
  const positionedOtherCells = useMemo(
    () =>
      otherCells.map((cell) => ({
        ...cell,
        rect: getScheduleCellRect(cell, pixelLayout),
      })),
    [otherCells, pixelLayout],
  );

  const renderCell = (
    cell: ScheduleCourseCell & { rect: ScheduleRect },
    key: string,
    isOther: boolean,
  ) => {
    return (
      <CourseCell
        key={key}
        course={cell.course}
        isOther={isOther}
        rect={cell.rect}
        bg={
          isOther
            ? otherWeekBg
            : (courseBackgrounds.get(cell.course.name) ?? "transparent")
        }
        theme={isOther ? otherTheme : currentTheme}
        stackCount={cell.count}
        sectionRange={cell.range}
        onPress={onCoursePress}
        onLongPress={onCourseLongPress}
      />
    );
  };

  return (
    <View
      style={{
        position: "absolute",
        left: pixelLayout.dayLeft[dayIdx],
        top: 0,
        width: pixelLayout.columnWidth,
        height: pixelLayout.height,
      }}
    >
      <View
        style={{
          height: pixelLayout.headerHeight,
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
              numberOfLines={1}
              style={{
                alignSelf: "stretch",
                textAlign: "center",
                fontSize: 12,
                fontWeight: isToday ? "800" : "600",
                color: isToday ? "#fff" : isDark ? "#d4d4d4" : "#525252",
              }}
            >
              {dayLabel}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                alignSelf: "stretch",
                textAlign: "center",
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
            numberOfLines={1}
            style={{
              alignSelf: "stretch",
              textAlign: "center",
              fontSize: 12,
              fontWeight: isToday ? "800" : "600",
              color: isToday ? "#3b82f6" : isDark ? "#d4d4d4" : "#525252",
            }}
          >
            {dayLabel}
          </Text>
        )}
      </View>

      <View
        style={{
          position: "absolute",
          top: pixelLayout.headerHeight,
          left: 0,
          width: pixelLayout.columnWidth,
          height: pixelLayout.gridHeight,
        }}
      >
        {pixelLayout.slots.map((slot) => {
          return (
            <Pressable
              key={slot.sectionStart}
              style={({ pressed }) => ({
                position: "absolute",
                ...slot.rect,
                backgroundColor: locatorBg,
                borderRadius: 6,
                opacity: pressed ? 0.6 : 1,
              })}
              onPress={() =>
                onAddSlot(dayIdx + 1, slot.sectionStart, slot.sectionEnd)
              }
            />
          );
        })}

        {positionedOtherCells.map((cell, ci) =>
          renderCell(
            cell,
            `other-${getMappingKey(`${cell.course.name}-${cell.course.sectionStart}-${cell.course.weekStart}-${ci}`, ci)}`,
            true,
          ),
        )}

        {positionedCurrentCells.map((cell, ci) =>
          renderCell(
            cell,
            `cur-${getMappingKey(cell.range.sectionStart, ci)}`,
            false,
          ),
        )}
      </View>
    </View>
  );
});
