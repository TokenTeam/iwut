import type { Course } from "@/store/course";

export type CourseSectionRange = Pick<Course, "sectionStart" | "sectionEnd">;

export interface ScheduleSlot extends CourseSectionRange {
  top: number;
  height: number;
}

export interface ScheduleLayoutInfo {
  sectionTop: Record<number, number>;
  sectionPct: number;
  visibleSections: number[];
  slots: ScheduleSlot[];
}

export interface ScheduleCourseCell extends ScheduleSlot {
  course: Course;
  count: number;
  range: CourseSectionRange;
}

export interface ScheduleRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface SchedulePixelLayout {
  columnWidth: number;
  headerHeight: number;
  gridHeight: number;
  height: number;
  width: number;
  dayLeft: number[];
  slots: (ScheduleSlot & { rect: ScheduleRect })[];
  sectionTop: Record<number, number>;
  sectionBottom: Record<number, number>;
}

export function buildSchedulePixelLayout(
  layout: ScheduleLayoutInfo,
  columnWidth: number,
  height: number,
  headerHeight: number,
): SchedulePixelLayout {
  const gridHeight = Math.max(0, height - headerHeight);
  const sectionTop: Record<number, number> = {};
  const sectionBottom: Record<number, number> = {};
  for (const section of layout.visibleSections) {
    sectionTop[section] = (gridHeight * layout.sectionTop[section]) / 100;
    sectionBottom[section] =
      (gridHeight * (layout.sectionTop[section] + layout.sectionPct)) / 100;
  }
  const pixelLayout = {
    columnWidth,
    headerHeight,
    gridHeight,
    height,
    width: columnWidth * 7,
    dayLeft: Array.from({ length: 7 }, (_, day) => columnWidth * day),
    sectionTop,
    sectionBottom,
  };
  return {
    ...pixelLayout,
    slots: layout.slots.map((slot) => ({
      ...slot,
      rect: getScheduleCellRect(slot, pixelLayout),
    })),
  };
}

export function getScheduleCellRect(
  range: CourseSectionRange,
  layout: Pick<
    SchedulePixelLayout,
    "columnWidth" | "sectionTop" | "sectionBottom"
  >,
): ScheduleRect {
  const top = layout.sectionTop[range.sectionStart];
  const bottom = layout.sectionBottom[range.sectionEnd];
  return {
    top: top + 2,
    left: 2,
    width: Math.max(0, layout.columnWidth - 4),
    height: Math.max(0, bottom - top - 4),
  };
}

export function buildScheduleLayout(groups: number[][]): ScheduleLayoutInfo {
  const visibleSections = groups.flat();
  const sectionPct = 100 / visibleSections.length;
  const sectionTop: Record<number, number> = {};
  visibleSections.forEach((section, index) => {
    sectionTop[section] = index * sectionPct;
  });
  const slots = groups.map((group) => {
    const sectionStart = group[0];
    const sectionEnd = group[group.length - 1];
    return {
      sectionStart,
      sectionEnd,
      top: sectionTop[sectionStart],
      height: sectionTop[sectionEnd] + sectionPct - sectionTop[sectionStart],
    };
  });
  return { sectionTop, sectionPct, visibleSections, slots };
}

export function indexScheduleCourses(courses: Course[]) {
  const days: Course[][] = Array.from({ length: 7 }, () => []);
  for (const course of courses) {
    if (Number.isInteger(course.day) && course.day >= 1 && course.day <= 7) {
      days[course.day - 1].push(course);
    }
  }
  return days.map((day) => {
    const validSections = day.every(
      (course) =>
        Number.isInteger(course.sectionStart) &&
        Number.isInteger(course.sectionEnd) &&
        course.sectionStart >= 1 &&
        course.sectionEnd <= 16 &&
        course.sectionStart <= course.sectionEnd,
    );
    return {
      courses: day,
      sortedCourses: [...day].sort((a, b) => a.sectionStart - b.sectionStart),
      validSections,
      sectionMasks: new Map(
        day.map((course) => [course, validSections ? sectionMask(course) : 0]),
      ),
    };
  });
}

export function isCourseInWeek(course: Course, week: number) {
  return course.weekStart <= week && course.weekEnd >= week;
}

function sectionMask(course: CourseSectionRange) {
  let mask = 0;
  for (
    let section = course.sectionStart;
    section <= course.sectionEnd;
    section++
  ) {
    mask |= 1 << (section - 1);
  }
  return mask;
}

export function buildCurrentWeekCourses(
  days: ReturnType<typeof indexScheduleCourses>,
  week: number,
) {
  return days.map((day) =>
    day.courses.filter((course) => isCourseInWeek(course, week)),
  );
}

export function buildOtherWeekSchedule(
  days: ReturnType<typeof indexScheduleCourses>,
  currentDays: Course[][],
  week: number,
  showOtherWeekCourses: boolean,
) {
  return days.map((day, dayIdx) => {
    const current = currentDays[dayIdx];
    const other = showOtherWeekCourses
      ? day.courses.filter((course) => !isCourseInWeek(course, week))
      : [];
    const visibleOther: Course[] = [];
    if (showOtherWeekCourses) {
      // Imported legacy ranges outside the grid retain interval-based behavior.
      const { validSections, sectionMasks } = day;
      let occupiedMask = current.reduce((mask, course) => {
        return mask | (sectionMasks.get(course) ?? 0);
      }, 0);
      for (const course of day.sortedCourses) {
        if (isCourseInWeek(course, week)) continue;
        const mask = sectionMasks.get(course) ?? 0;
        const overlaps = validSections
          ? (occupiedMask & mask) !== 0
          : [...current, ...visibleOther].some(
              (occupied) =>
                occupied.sectionStart <= course.sectionEnd &&
                course.sectionStart <= occupied.sectionEnd,
            );
        if (overlaps) continue;
        occupiedMask |= mask;
        visibleOther.push(course);
      }
    }
    return { current, other, visibleOther };
  });
}

export function getScheduleConflicts(
  day: ReturnType<typeof buildOtherWeekSchedule>[number],
  course: Course,
  range: CourseSectionRange,
  week: number,
) {
  const conflicts = [...day.current, ...day.other].filter(
    (other) =>
      other.sectionStart <= range.sectionEnd &&
      range.sectionStart <= other.sectionEnd,
  );
  conflicts.sort((a, b) => {
    const currentOrder =
      Number(!isCourseInWeek(a, week)) - Number(!isCourseInWeek(b, week));
    return currentOrder || a.weekStart - b.weekStart;
  });
  return conflicts.length > 0 ? conflicts : [course];
}

export function buildCurrentScheduleCells(
  current: Course[],
  layout: ScheduleLayoutInfo,
) {
  const entries = current.flatMap((course) => {
    const sections = layout.visibleSections.filter(
      (section) =>
        section >= course.sectionStart && section <= course.sectionEnd,
    );
    if (sections.length === 0) return [];
    return [
      {
        course,
        count: 1,
        sectionStart: sections[0],
        sectionEnd: sections[sections.length - 1],
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

  return groups.flatMap((group) =>
    toScheduleCell(group.course, group, group.count, layout),
  );
}

function toScheduleCell(
  course: Course,
  range: CourseSectionRange,
  count: number,
  layout: ScheduleLayoutInfo,
): ScheduleCourseCell[] {
  const sections = layout.visibleSections.filter(
    (section) => section >= range.sectionStart && section <= range.sectionEnd,
  );
  if (sections.length === 0) return [];
  const sectionStart = sections[0];
  const sectionEnd = sections[sections.length - 1];
  const top = layout.sectionTop[sectionStart];
  return [
    {
      course,
      range,
      count,
      sectionStart,
      sectionEnd,
      top,
      height: layout.sectionTop[sectionEnd] + layout.sectionPct - top,
    },
  ];
}

export function buildOtherScheduleCells(
  other: Course[],
  layout: ScheduleLayoutInfo,
) {
  return other.flatMap((course) => toScheduleCell(course, course, 1, layout));
}
