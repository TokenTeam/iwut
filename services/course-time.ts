export const SECTION_TIMES: Record<
  number,
  [start: string, end: string, startMin: number, endMin: number]
> = {
  1: ["8:00", "8:45", 480, 525],
  2: ["8:50", "9:35", 530, 575],
  3: ["9:55", "10:40", 595, 640],
  4: ["10:45", "11:30", 645, 690],
  5: ["11:35", "12:20", 695, 740],
  6: ["12:25", "13:10", 745, 790],
  7: ["13:15", "13:50", 790, 830],
  8: ["14:00", "14:45", 840, 885],
  9: ["14:50", "15:35", 890, 935],
  10: ["15:40", "16:25", 940, 985],
  11: ["16:45", "17:30", 1005, 1050],
  12: ["17:35", "18:20", 1055, 1100],
  13: ["18:20", "19:00", 1100, 1140],
  14: ["19:00", "19:45", 1140, 1185],
  15: ["19:50", "20:35", 1190, 1235],
  16: ["20:40", "21:25", 1240, 1285],
};

export const MIDDAY_SECTIONS = [6, 7, 13];

export function formatCourseSectionTimeRange(
  sectionStart: number,
  sectionEnd: number,
): string {
  const start = SECTION_TIMES[sectionStart]?.[0] ?? "";
  const end = SECTION_TIMES[sectionEnd]?.[1] ?? "";
  return start && end ? `${start} - ${end}` : "";
}

interface CourseTimeFields {
  sectionStart: number;
  sectionEnd: number;
  startTime?: string;
  endTime?: string;
}

function timeToMinutes(time?: string): number | null {
  if (!time) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

// 以下取值均优先课程携带的真实时间，节次时间作兜底

export function getCourseStartMin(course: CourseTimeFields): number {
  return (
    timeToMinutes(course.startTime) ??
    SECTION_TIMES[course.sectionStart]?.[2] ??
    0
  );
}

export function getCourseEndMin(course: CourseTimeFields): number {
  return (
    timeToMinutes(course.endTime) ?? SECTION_TIMES[course.sectionEnd]?.[3] ?? 0
  );
}

export function formatCourseTimeRange(course: CourseTimeFields): string {
  if (course.startTime && course.endTime) {
    return `${course.startTime} - ${course.endTime}`;
  }
  return formatCourseSectionTimeRange(course.sectionStart, course.sectionEnd);
}
