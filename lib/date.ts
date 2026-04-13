const MAX_WEEK = 20;

export function getCurrentWeek(termStart: string): number {
  if (!termStart) return 1;
  const start = new Date(termStart + "T00:00:00");
  const today = new Date();
  const week =
    Math.floor(
      (today.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000),
    ) + 1;
  return Math.max(1, Math.min(week, MAX_WEEK));
}

export function getCurrentDayOfWeek(): number {
  const day = new Date().getDay();
  return day === 0 ? 7 : day;
}

export function getTomorrowDayOfWeek(): number {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const day = d.getDay();
  return day === 0 ? 7 : day;
}

export function getTomorrowWeek(termStart: string): number {
  if (!termStart) return 1;
  const start = new Date(termStart + "T00:00:00");
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const week =
    Math.floor(
      (tomorrow.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000),
    ) + 1;
  return Math.max(1, Math.min(week, MAX_WEEK));
}

export function isVacation(termStart: string): boolean {
  if (!termStart) return false;
  const start = new Date(termStart + "T00:00:00");
  const today = new Date();
  const week =
    Math.floor(
      (today.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000),
    ) + 1;
  return week > MAX_WEEK || week < 1;
}

export function getTermWeekMonday(
  termStart: string,
  week: number,
): Date | null {
  if (!termStart) return null;
  const start = new Date(termStart + "T00:00:00");
  if (Number.isNaN(start.getTime())) return null;
  const monday = new Date(start);
  monday.setDate(monday.getDate() + (week - 1) * 7);
  return monday;
}

export function getTermWeekMonthLabel(
  termStart: string,
  week: number,
): string | null {
  const monday = getTermWeekMonday(termStart, week);
  if (!monday) return null;
  const m = monday.getMonth() + 1;
  return `${m}\n月`;
}

export function getTermWeekDayNumbers(
  termStart: string,
  week: number,
): number[] | null {
  const monday = getTermWeekMonday(termStart, week);
  if (!monday) return null;
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d.getDate();
  });
}
