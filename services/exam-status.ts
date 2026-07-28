import type { Exam, ExamStatus } from "@/store/exam";

function clean(value: unknown): string {
  const text = value == null ? "" : String(value).trim();
  if (!text || text === "null" || text === "-") return "";
  return text;
}

export function normalizeRawExamStatus(value: unknown): ExamStatus {
  const text = clean(value);
  if (text === "0" || text.includes("未开始")) return "upcoming";
  if (text === "1" || text.includes("进行")) return "ongoing";
  if (text === "2" || text.includes("完成") || text.includes("已结束")) {
    return "finished";
  }
  return "unknown";
}

function hasCustomRawStatus(value: unknown): boolean {
  const text = clean(value);
  return !!text && normalizeRawExamStatus(text) === "unknown";
}

export function getExamStatus(
  exam: Pick<Exam, "rawStatus" | "startAt" | "endAt">,
  nowMs: number,
): ExamStatus {
  const rawStatus = normalizeRawExamStatus(exam.rawStatus);
  if (hasCustomRawStatus(exam.rawStatus)) return "unknown";
  if (rawStatus === "finished") return "finished";

  const startMs = Date.parse(exam.startAt);
  const endMs = Date.parse(exam.endAt);

  if (!Number.isNaN(endMs) && endMs <= nowMs) return "finished";
  if (
    !Number.isNaN(startMs) &&
    !Number.isNaN(endMs) &&
    startMs <= nowMs &&
    nowMs < endMs
  ) {
    return "ongoing";
  }
  if (!Number.isNaN(startMs) && startMs > nowMs) return "upcoming";

  return rawStatus;
}
