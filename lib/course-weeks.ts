import type { Course } from "@/store/course";

export const MAX_WEEK = 20;
export const MAX_SECTION = 16;

export function weeksToRanges(weeks: Set<number>): [number, number][] {
  const sorted = [...weeks].sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  const ranges: [number, number][] = [];
  let start = sorted[0];
  let end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push([start, end]);
      start = sorted[i];
      end = sorted[i];
    }
  }
  ranges.push([start, end]);
  return ranges;
}

/**
 * 返回 `weeks` 中与同 day 同节次段已有课程冲突的具体周次。
 * 节次相交判定与课程详情中的 conflict 逻辑一致。
 */
export function findConflictWeeks(
  courses: Course[],
  day: number,
  sectionStart: number,
  sectionEnd: number,
  weeks: Iterable<number>,
): number[] {
  const conflict: number[] = [];
  for (const w of weeks) {
    const hit = courses.some(
      (c) =>
        c.day === day &&
        c.weekStart <= w &&
        c.weekEnd >= w &&
        c.sectionStart <= sectionEnd &&
        c.sectionEnd >= sectionStart,
    );
    if (hit) conflict.push(w);
  }
  return conflict;
}
