import { MAX_WEEK } from "@/lib/course-weeks";

// 学期相关时间一律按 UTC+8 计算，
// 保证通知、日历与课表在任意设备时区下行为一致。
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** 解析 "YYYY-MM-DD" 为 UTC+8 当日零点的绝对时间戳 */
function parseTermStartMs(termStart: string): number | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(termStart);
  if (!m) return null;
  return (
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - SHANGHAI_OFFSET_MS
  );
}

/** 返回一个可用 getUTC* 读取 UTC+8 字段的 Date 视图 */
function shanghaiView(ms: number): Date {
  return new Date(ms + SHANGHAI_OFFSET_MS);
}

function weekOf(ms: number, termStartMs: number): number {
  return Math.floor((ms - termStartMs) / WEEK_MS) + 1;
}

export function getCurrentWeek(termStart: string): number {
  const startMs = parseTermStartMs(termStart);
  if (startMs == null) return 1;
  const week = weekOf(Date.now(), startMs);
  return Math.max(1, Math.min(week, MAX_WEEK));
}

export function getCurrentDayOfWeek(): number {
  const day = shanghaiView(Date.now()).getUTCDay();
  return day === 0 ? 7 : day;
}

export function getTomorrowDayOfWeek(): number {
  const day = shanghaiView(Date.now() + DAY_MS).getUTCDay();
  return day === 0 ? 7 : day;
}

export function getTomorrowWeek(termStart: string): number {
  const startMs = parseTermStartMs(termStart);
  if (startMs == null) return 1;
  const week = weekOf(Date.now() + DAY_MS, startMs);
  return Math.max(1, Math.min(week, MAX_WEEK));
}

export function isVacation(termStart: string): boolean {
  const startMs = parseTermStartMs(termStart);
  if (startMs == null) return false;
  const week = weekOf(Date.now(), startMs);
  return week > MAX_WEEK || week < 1;
}

/** 第 week 周周一的绝对时间戳 */
export function getTermWeekMondayMs(
  termStart: string,
  week: number,
): number | null {
  const startMs = parseTermStartMs(termStart);
  if (startMs == null) return null;
  return startMs + (week - 1) * WEEK_MS;
}

/**
 * 第 week 周星期 dayOfWeek（1-7）的 "HH:mm" 对应的绝对时间戳，
 */
export function getTermWeekMonthLabel(
  termStart: string,
  week: number,
): string | null {
  const mondayMs = getTermWeekMondayMs(termStart, week);
  if (mondayMs == null) return null;
  const m = shanghaiView(mondayMs).getUTCMonth() + 1;
  return `${m}\n月`;
}

export function getTermWeekDayNumbers(
  termStart: string,
  week: number,
): number[] | null {
  const mondayMs = getTermWeekMondayMs(termStart, week);
  if (mondayMs == null) return null;
  return Array.from({ length: 7 }, (_, i) =>
    shanghaiView(mondayMs + i * DAY_MS).getUTCDate(),
  );
}
