import type { Course } from "@/store/course";

/** 按课程名首次出现顺序分配调色板下标 */
export function buildColorMap(
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

/** 课程配色：用户覆写 > 调色板内置覆写 > 按下标取色 */
export function getCourseColor(
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
