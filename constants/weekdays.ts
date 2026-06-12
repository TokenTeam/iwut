import { t, type TKey } from "@/lib/i18n";

export const WEEKDAY_KEYS = [
  "schedule.weekday.mon",
  "schedule.weekday.tue",
  "schedule.weekday.wed",
  "schedule.weekday.thu",
  "schedule.weekday.fri",
  "schedule.weekday.sat",
  "schedule.weekday.sun",
] as const satisfies readonly TKey[];

/** 按当前语言返回周一至周日的短标签 */
export function getDayLabels(): string[] {
  return WEEKDAY_KEYS.map((k) => t(k));
}
