import { t } from "@/lib/i18n";
import { getExamStatus } from "@/services/exam-status";
import type { Exam } from "@/store/exam";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export interface ExamReminderItem {
  key: string;
  title: string;
  body: string;
  triggerAtMs: number;
}

// 考点固定在东八区，且中国无夏令时，所以直接用 +08:00 偏移构造时间戳，
// 不受设备时区影响。
function eveningBeforeMs(date: string): number {
  // 考试当天 22:00（东八区）再减一天 = 前一天晚上 10 点。
  return Date.parse(`${date}T22:00:00+08:00`) - DAY_MS;
}

function formatBody(exam: Exam): string {
  const [, month, day] = exam.date.split("-").map((n) => parseInt(n, 10));
  const dateText = t("common.monthDay", { m: month, d: day });
  const timeText = exam.endTime
    ? `${exam.startTime}-${exam.endTime}`
    : exam.startTime;

  const parts = [`${dateText} ${timeText}`];
  if (exam.place) parts.push(exam.place);
  if (exam.seatNo) parts.push(`${t("exam.seatNo")} ${exam.seatNo}`);

  return parts.join(" · ");
}

// 每场未结束的考试生成两条提醒：前一天 22:00 + 考前 1 小时。
// 已过的触发时间会被跳过。
export function buildExamReminders(
  exams: Exam[],
  nowMs: number,
): ExamReminderItem[] {
  const items: ExamReminderItem[] = [];

  for (const exam of exams) {
    if (getExamStatus(exam, nowMs) === "finished") continue;

    const startMs = Date.parse(exam.startAt);
    if (Number.isNaN(startMs)) continue;

    const title = exam.courseName || t("exam.title");
    const body = formatBody(exam);

    const evening = eveningBeforeMs(exam.date);
    if (!Number.isNaN(evening) && evening > nowMs) {
      items.push({
        key: `exam|${exam.id}|evening`,
        title,
        body,
        triggerAtMs: evening,
      });
    }

    const hourBefore = startMs - HOUR_MS;
    if (hourBefore > nowMs) {
      items.push({
        key: `exam|${exam.id}|hour`,
        title,
        body,
        triggerAtMs: hourBefore,
      });
    }
  }

  return items;
}
