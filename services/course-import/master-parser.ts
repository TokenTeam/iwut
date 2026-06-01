export interface MasterTimeTableRow {
  JieCi?: string | null;
  Monday?: string | null;
  Tuesday?: string | null;
  Wednesday?: string | null;
  Thursday?: string | null;
  Friday?: string | null;
  Saturday?: string | null;
  Sunday?: string | null;
}

export interface ParsedMasterCourse {
  name: string;
  room: string;
  teacher: string;
  weekStart: number;
  weekEnd: number;
  day: number;
  sectionStart: number;
  sectionEnd: number;
}

type MasterWeekdayField =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

const MASTER_WEEKDAY_FIELDS: Array<{
  field: MasterWeekdayField;
  day: number;
}> = [
  { field: "Monday", day: 1 },
  { field: "Tuesday", day: 2 },
  { field: "Wednesday", day: 3 },
  { field: "Thursday", day: 4 },
  { field: "Friday", day: 5 },
  { field: "Saturday", day: 6 },
  { field: "Sunday", day: 7 },
];

const MASTER_SECTION_MAP: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 8,
  7: 9,
  8: 10,
  9: 11,
  10: 12,
  11: 14,
  12: 15,
  13: 16,
};

function parseMasterSections(
  sectionText: string,
  fallback: string,
): {
  sectionStart: number;
  sectionEnd: number;
} | null {
  const source = `${sectionText} ${fallback}`;
  const nums = source.match(/\d+/g)?.map(Number) ?? [];
  const sections = nums
    .map((n) => MASTER_SECTION_MAP[n])
    .filter((n): n is number => Number.isFinite(n));

  if (sections.length === 0) return null;

  return {
    sectionStart: sections[0],
    sectionEnd: sections[sections.length - 1],
  };
}

function parseMasterWeekSpans(weekText: string): Array<{
  weekStart: number;
  weekEnd: number;
}> {
  const text = weekText.replace(/^周次[:：]\s*/, "");
  const spans: Array<{ weekStart: number; weekEnd: number }> = [];
  const re = /(\d+)(?:\s*-\s*(\d+))?(?:\s*[（(](单周|双周)[）)])?/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const weekStart = Number(match[1]);
    const weekEnd = match[2] ? Number(match[2]) : weekStart;
    const parity = match[3];

    if (!Number.isFinite(weekStart) || !Number.isFinite(weekEnd)) continue;

    if (parity === "单周" || parity === "双周") {
      const expected = parity === "单周" ? 1 : 0;
      for (let week = weekStart; week <= weekEnd; week++) {
        if (week % 2 === expected) {
          spans.push({ weekStart: week, weekEnd: week });
        }
      }
    } else {
      spans.push({ weekStart, weekEnd });
    }
  }

  return spans;
}

function getMasterLineValue(lines: string[], label: string): string {
  const line = lines.find((item) => item.startsWith(label));
  return line?.slice(label.length).trim() ?? "";
}

function parseMasterCourseBlock(
  block: string,
  day: number,
  fallbackSections: string,
): ParsedMasterCourse[] {
  const lines = block
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const name = lines[0] ?? "";
  if (!name) return [];

  const isExam = name.startsWith("[考试]");
  const teacher = isExam ? "" : (lines[1] ?? "").split(/\s+/)[0];
  const sectionInfo = parseMasterSections(
    getMasterLineValue(lines, "节次:"),
    fallbackSections,
  );
  const weeks = parseMasterWeekSpans(getMasterLineValue(lines, "周次:"));
  const room = getMasterLineValue(lines, "地点:");

  if (!sectionInfo || weeks.length === 0) return [];

  return weeks.map((week) => ({
    name,
    room,
    teacher,
    day,
    sectionStart: sectionInfo.sectionStart,
    sectionEnd: sectionInfo.sectionEnd,
    weekStart: week.weekStart,
    weekEnd: week.weekEnd,
  }));
}

export function parseMasterCourseRows(
  rows: MasterTimeTableRow[],
): ParsedMasterCourse[] {
  const courses = rows.flatMap((row) =>
    MASTER_WEEKDAY_FIELDS.flatMap(({ field, day }) => {
      const text = row[field]?.trim();
      if (!text) return [];

      return text
        .replace(/\r\n/g, "\n")
        .split(/\n\s*\n/)
        .flatMap((block) =>
          parseMasterCourseBlock(block, day, row.JieCi ?? ""),
        );
    }),
  );

  return courses.sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    if (a.weekStart !== b.weekStart) return a.weekStart - b.weekStart;
    if (a.sectionStart !== b.sectionStart) {
      return a.sectionStart - b.sectionStart;
    }
    return a.name.localeCompare(b.name);
  });
}
