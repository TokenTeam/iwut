import { MAX_SECTION, MAX_WEEK } from "@/lib/course-weeks";
import type { Course } from "@/store/course";

function toInt(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isInteger(n)) return null;
  return n;
}

function toText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * 校验并规范化一条来自 WebView 的导入课程数据，字段缺失或越界时返回 null。
 */
export function parseImportedCourse(raw: unknown): Course | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const name = toText(r.name);
  if (!name) return null;

  const day = toInt(r.day);
  const sectionStart = toInt(r.sectionStart);
  const sectionEnd = toInt(r.sectionEnd);
  const weekStart = toInt(r.weekStart);
  const weekEnd = toInt(r.weekEnd);

  if (day == null || day < 1 || day > 7) return null;
  if (
    sectionStart == null ||
    sectionEnd == null ||
    sectionStart < 1 ||
    sectionEnd > MAX_SECTION ||
    sectionStart > sectionEnd
  ) {
    return null;
  }
  if (
    weekStart == null ||
    weekEnd == null ||
    weekStart < 1 ||
    weekEnd > MAX_WEEK ||
    weekStart > weekEnd
  ) {
    return null;
  }

  return {
    name,
    room: toText(r.room),
    teacher: toText(r.teacher),
    day,
    sectionStart,
    sectionEnd,
    weekStart,
    weekEnd,
    source: "imported",
  };
}
