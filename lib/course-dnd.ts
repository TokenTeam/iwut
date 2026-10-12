import { MAX_WEEK } from "@/lib/course-weeks";
import { getTermClassTimeMs } from "@/lib/date";
import { SECTION_TIMES } from "@/services/course-time";
import type { Course } from "@/store/course";

export interface CourseDndInterval {
  start: number;
  end: number;
}

function validTime(time: string): boolean {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  return !!match && Number(match[1]) < 24 && Number(match[2]) < 60;
}

/** Whole-term intervals in Shanghai time, independent of the displayed week. */
export function buildCourseDndIntervals(
  courses: Course[],
  termStart: string,
  now = Date.now(),
): CourseDndInterval[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(termStart)) return [];
  const date = new Date(`${termStart}T00:00:00+08:00`);
  if (
    !Number.isFinite(date.getTime()) ||
    new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 10) !==
      termStart
  ) {
    return [];
  }

  const intervals: CourseDndInterval[] = [];
  for (const course of courses) {
    if (
      !Number.isInteger(course.day) ||
      course.day < 1 ||
      course.day > 7 ||
      !Number.isInteger(course.weekStart) ||
      !Number.isInteger(course.weekEnd)
    ) {
      continue;
    }
    const startTime =
      course.startTime || SECTION_TIMES[course.sectionStart]?.[0];
    const endTime = course.endTime || SECTION_TIMES[course.sectionEnd]?.[1];
    if (
      !startTime ||
      !endTime ||
      !validTime(startTime) ||
      !validTime(endTime)
    ) {
      continue;
    }
    for (
      let week = Math.max(1, course.weekStart);
      week <= Math.min(MAX_WEEK, course.weekEnd);
      week++
    ) {
      const start = getTermClassTimeMs(termStart, week, course.day, startTime);
      const end = getTermClassTimeMs(termStart, week, course.day, endTime);
      if (start != null && end != null && end > start && end > now) {
        intervals.push({ start, end });
      }
    }
  }

  intervals.sort((a, b) => a.start - b.start);
  const merged: CourseDndInterval[] = [];
  for (const interval of intervals) {
    const last = merged.at(-1);
    if (last && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}
