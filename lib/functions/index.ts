import { SECTIONS } from "./sections";
import type { FilterUser, Section, UserMatch, WebApp } from "./types";

export type {
  FilterRule,
  FilterUser,
  Section,
  UserMatch,
  WebApp,
} from "./types";

function matchesValues(
  value: string,
  candidates: readonly string[] | undefined,
  prefix = false,
): boolean {
  if (candidates === undefined) return true;
  const normalized = value.trim();
  if (!normalized) return false;
  return candidates.some((candidate) => {
    const expected = candidate.trim();
    return (
      !!expected &&
      (prefix ? normalized.startsWith(expected) : normalized === expected)
    );
  });
}

export function matchesUser(user: FilterUser, match: UserMatch): boolean {
  // 空条件不进行匹配，避免误放行或误拒绝
  const hasCondition =
    match.studentIds !== undefined ||
    match.studentIdPrefixes !== undefined ||
    match.colleges !== undefined ||
    match.eduLevels !== undefined ||
    match.hasCardId !== undefined;
  if (!hasCondition || !user.isBound) return false;

  return (
    matchesValues(user.studentId, match.studentIds) &&
    matchesValues(user.studentId, match.studentIdPrefixes, true) &&
    matchesValues(user.college, match.colleges) &&
    matchesValues(user.eduLevel, match.eduLevels) &&
    (match.hasCardId === undefined || !!user.cardId.trim() === match.hasCardId)
  );
}

export function isFunctionVisible(app: WebApp, user: FilterUser): boolean {
  const rule = app.filter;
  if (!rule) return true;
  if (rule.requireBound && !user.isBound) return false;
  if (rule.deny?.some((match) => matchesUser(user, match))) return false;
  return (
    rule.allow === undefined ||
    rule.allow.some((match) => matchesUser(user, match))
  );
}

export function filterSections(user: FilterUser): Section[] {
  return SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => isFunctionVisible(item, user)),
  })).filter((section) => section.items.length > 0);
}
