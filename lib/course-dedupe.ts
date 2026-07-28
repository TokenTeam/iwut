import { weeksToRanges } from "@/lib/course-weeks";
import type { Course } from "@/store/course";

/**
 * 本科/研究生课表可能已包含实验课，与实验课导入的同名记录在相同时段重复。
 * 同名、同星期且节次重叠时，实验课覆盖的周次以实验课为准，
 * 普通导入课程只保留其余周次；手动添加的课程不受影响。
 */
export function dedupeCourses(courses: Course[]): Course[] {
  const labs = courses.filter((c) => c.source === "lab");
  if (labs.length === 0) return courses;

  const result: Course[] = [];
  for (const c of courses) {
    if (c.source === "lab" || c.source === "manual") {
      result.push(c);
      continue;
    }

    const overlapping = labs.filter(
      (l) =>
        l.name === c.name &&
        l.day === c.day &&
        l.sectionStart <= c.sectionEnd &&
        c.sectionStart <= l.sectionEnd,
    );
    if (overlapping.length === 0) {
      result.push(c);
      continue;
    }

    const weeks = new Set<number>();
    for (let w = c.weekStart; w <= c.weekEnd; w++) {
      if (!overlapping.some((l) => l.weekStart <= w && w <= l.weekEnd)) {
        weeks.add(w);
      }
    }
    for (const [weekStart, weekEnd] of weeksToRanges(weeks)) {
      result.push({ ...c, weekStart, weekEnd });
    }
  }
  return result;
}
