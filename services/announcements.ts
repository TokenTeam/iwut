import Constants from "expo-constants";
import { Platform } from "react-native";

import { CONFIG_REPO_CDN } from "@/constants/api";

export type AnnouncementType = "info" | "warning" | "event" | "maintenance";
export type AnnouncementPlatform = "ios" | "android" | "web";

export interface AnnouncementLink {
  kind: "internal" | "external";
  url: string;
}

export interface Announcement {
  id: string;
  type: AnnouncementType;
  title: string;
  body: string | null;
  link: AnnouncementLink | null;
  startAt: string | null;
  endAt: string | null;
  priority: number;
  dismissible: boolean;
  minVersion: string | null;
  maxVersion: string | null;
  platforms: AnnouncementPlatform[] | null;
}

const SUPPORTED_VERSION = 1;
const VALID_TYPES: ReadonlySet<AnnouncementType> = new Set([
  "info",
  "warning",
  "event",
  "maintenance",
]);
const VALID_PLATFORMS: ReadonlySet<AnnouncementPlatform> = new Set([
  "ios",
  "android",
  "web",
]);
const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const VERSION_PATTERN = /^\d+(\.\d+){0,2}$/;
const MAX_RENDERED = 5;

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseLink(raw: unknown): AnnouncementLink | null {
  if (raw === null || raw === undefined) return null;
  if (!isObject(raw)) return null;
  const kind = raw.kind;
  const url = raw.url;
  if (typeof url !== "string") return null;
  if (kind === "internal" && url.startsWith("/")) {
    return { kind: "internal", url };
  }
  if (kind === "external" && /^https?:\/\//.test(url)) {
    return { kind: "external", url };
  }
  return null;
}

function parseAnnouncement(raw: unknown): Announcement | null {
  if (!isObject(raw)) return null;

  const id = raw.id;
  if (typeof id !== "string" || !ID_PATTERN.test(id) || id.length > 64) {
    return null;
  }

  const type = raw.type;
  if (typeof type !== "string" || !VALID_TYPES.has(type as AnnouncementType)) {
    return null;
  }

  const title = raw.title;
  if (typeof title !== "string" || title.length === 0 || title.length > 40) {
    return null;
  }

  const body =
    typeof raw.body === "string" && raw.body.length <= 200 ? raw.body : null;

  const link = parseLink(raw.link);

  const startAt = typeof raw.startAt === "string" ? raw.startAt : null;
  const endAt = typeof raw.endAt === "string" ? raw.endAt : null;

  let priority = 0;
  if (typeof raw.priority === "number" && Number.isFinite(raw.priority)) {
    priority = Math.max(0, Math.min(100, Math.floor(raw.priority)));
  }

  const dismissible = raw.dismissible === false ? false : true;

  const minVersion =
    typeof raw.minVersion === "string" && VERSION_PATTERN.test(raw.minVersion)
      ? raw.minVersion
      : null;
  const maxVersion =
    typeof raw.maxVersion === "string" && VERSION_PATTERN.test(raw.maxVersion)
      ? raw.maxVersion
      : null;

  let platforms: AnnouncementPlatform[] | null = null;
  if (Array.isArray(raw.platforms)) {
    const filtered = raw.platforms.filter(
      (p): p is AnnouncementPlatform =>
        typeof p === "string" && VALID_PLATFORMS.has(p as AnnouncementPlatform),
    );
    platforms = filtered.length > 0 ? Array.from(new Set(filtered)) : null;
  }

  return {
    id,
    type: type as AnnouncementType,
    title,
    body,
    link,
    startAt,
    endAt,
    priority,
    dismissible,
    minVersion,
    maxVersion,
    platforms,
  };
}

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const data = await fetch(`${CONFIG_REPO_CDN}/announcements.json`, {
      signal: controller.signal,
    }).then((res) => res.json());

    if (!isObject(data) || data.version !== SUPPORTED_VERSION) return [];
    if (!Array.isArray(data.announcements)) return [];

    const parsed: Announcement[] = [];
    const seenIds = new Set<string>();
    for (const item of data.announcements) {
      const a = parseAnnouncement(item);
      if (!a || seenIds.has(a.id)) continue;
      seenIds.add(a.id);
      parsed.push(a);
    }
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

export function isNetworkError(err: unknown): boolean {
  if (typeof DOMException !== "undefined" && err instanceof DOMException) {
    return err.name === "AbortError";
  }
  if (
    err &&
    typeof err === "object" &&
    (err as { name?: string }).name === "AbortError"
  ) {
    return true;
  }
  return err instanceof TypeError;
}

export function filterActiveAnnouncements(
  announcements: Announcement[],
  dismissedIds: readonly string[],
  now: Date = new Date(),
): Announcement[] {
  const appVersion = Constants.expoConfig?.version ?? "0.0.0";
  const platform = Platform.OS as AnnouncementPlatform;
  const dismissed = new Set(dismissedIds);
  const nowMs = now.getTime();

  return announcements
    .filter((a) => {
      if (dismissed.has(a.id)) return false;
      if (a.startAt) {
        const t = Date.parse(a.startAt);
        if (Number.isFinite(t) && nowMs < t) return false;
      }
      if (a.endAt) {
        const t = Date.parse(a.endAt);
        if (Number.isFinite(t) && nowMs > t) return false;
      }
      if (a.minVersion && compareVersions(appVersion, a.minVersion) < 0) {
        return false;
      }
      if (a.maxVersion && compareVersions(appVersion, a.maxVersion) > 0) {
        return false;
      }
      if (a.platforms && !a.platforms.includes(platform)) return false;
      return true;
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_RENDERED);
}
