import { MAX_WEEK } from "@/lib/course-weeks";
import type { Exam } from "@/store/exam";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

function parseTermStartMs(termStart: string): number | null {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(termStart);
  if (!match) return null;
  return (
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) -
    SHANGHAI_OFFSET_MS
  );
}

function termCodeFromStart(termStart: string): string {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(termStart);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month >= 7) return `${year}-${year + 1}-1`;
  return `${year - 1}-${year}-2`;
}

export function getTermRangeMs(
  termStart: string,
): { startMs: number; endMs: number; termCode: string } | null {
  const startMs = parseTermStartMs(termStart);
  if (startMs == null) return null;
  return {
    startMs,
    endMs: startMs + MAX_WEEK * WEEK_MS,
    termCode: termCodeFromStart(termStart),
  };
}

export function isExamInTerm(exam: Exam, termStart: string): boolean {
  const range = getTermRangeMs(termStart);
  if (!range) return true;
  const startMs = Date.parse(exam.startAt);
  if (Number.isNaN(startMs)) return true;
  return startMs >= range.startMs && startMs < range.endMs;
}

export function shouldClearExamDataForTerm({
  term,
  exams,
  termStart,
}: {
  term: string;
  exams: Exam[];
  termStart: string;
}): boolean {
  const range = getTermRangeMs(termStart);
  if (!range) return false;
  if (term && range.termCode && term !== range.termCode) return true;
  return (
    exams.length > 0 && exams.every((exam) => !isExamInTerm(exam, termStart))
  );
}
