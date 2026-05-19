import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { Platform } from "react-native";

import { CONFIG_REPO_CDN } from "@/constants/api";
import type { ResolvedLang } from "@/lib/i18n";

export type UpdateLevel = "silent" | "recommended" | "required";
type UpdatePlatform = "ios" | "android" | "web";

export type LocalizedString = string | Partial<Record<string, string>>;
export type LocalizedStringArray = string[] | Partial<Record<string, string[]>>;

export interface ReleaseDownloadUrl {
  ios: string | null;
  android: string | null;
}

export interface Release {
  version: string;
  level: UpdateLevel;
  reason: LocalizedString | null;
  releasedAt: string | null;
  platforms: UpdatePlatform[] | null;
  title: LocalizedString | null;
  highlights: LocalizedStringArray | null;
  changelog: LocalizedString | null;
  downloadUrl: ReleaseDownloadUrl | null;
}

interface ChannelManifest {
  latestVersion: string;
  minSupportedVersion: string | null;
  releases: Release[];
}

export interface UpdateManifest {
  version: 1;
  updatedAt: string | null;
  channels: Record<string, ChannelManifest>;
}

interface UpdateSummary {
  hasUpdate: boolean;
  level: UpdateLevel;
  latestVersion: string | null;
  applicableReleases: Release[];
  blockedByMinVersion: boolean;
  reason: LocalizedString | null;
  downloadUrl: ReleaseDownloadUrl | null;
}

const SUPPORTED_VERSION = 1;
const VALID_LEVELS: ReadonlySet<UpdateLevel> = new Set([
  "silent",
  "recommended",
  "required",
]);
const VALID_PLATFORMS: ReadonlySet<UpdatePlatform> = new Set([
  "ios",
  "android",
  "web",
]);
const VERSION_PATTERN = /^\d+(\.\d+){0,2}$/;
const LEVEL_ORDER: Record<UpdateLevel, number> = {
  silent: 0,
  recommended: 1,
  required: 2,
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

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

function parseLocalizedString(raw: unknown): LocalizedString | null {
  if (typeof raw === "string") {
    return raw.length > 0 ? raw : null;
  }
  if (isObject(raw)) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === "string" && v.length > 0) out[k] = v;
    }
    if (typeof out.zh !== "string") return null;
    return out;
  }
  return null;
}

function parseLocalizedStringArray(raw: unknown): LocalizedStringArray | null {
  if (Array.isArray(raw)) {
    const list = raw.filter(
      (s): s is string => typeof s === "string" && s.length > 0,
    );
    return list.length > 0 ? list : null;
  }
  if (isObject(raw)) {
    const out: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (!Array.isArray(v)) continue;
      const list = v.filter(
        (s): s is string => typeof s === "string" && s.length > 0,
      );
      if (list.length > 0) out[k] = list;
    }
    if (!Array.isArray(out.zh)) return null;
    return out;
  }
  return null;
}

function parseDownloadUrl(raw: unknown): ReleaseDownloadUrl | null {
  if (!isObject(raw)) return null;
  const ios =
    typeof raw.ios === "string" && raw.ios.length > 0 ? raw.ios : null;
  const android =
    typeof raw.android === "string" && /^https?:\/\//.test(raw.android)
      ? raw.android
      : null;
  if (!ios && !android) return null;
  return { ios, android };
}

function parseRelease(raw: unknown): Release | null {
  if (!isObject(raw)) return null;

  const version = raw.version;
  if (typeof version !== "string" || !VERSION_PATTERN.test(version)) {
    return null;
  }

  const level = raw.level;
  if (typeof level !== "string" || !VALID_LEVELS.has(level as UpdateLevel)) {
    return null;
  }

  const reason = parseLocalizedString(raw.reason);
  // Required releases must carry a reason. Skip malformed entries to avoid
  // surfacing a force-update modal that can't even explain itself.
  if (level === "required" && reason === null) return null;

  let platforms: UpdatePlatform[] | null = null;
  if (Array.isArray(raw.platforms)) {
    const filtered = raw.platforms.filter(
      (p): p is UpdatePlatform =>
        typeof p === "string" && VALID_PLATFORMS.has(p as UpdatePlatform),
    );
    platforms = filtered.length > 0 ? Array.from(new Set(filtered)) : null;
  }

  return {
    version,
    level: level as UpdateLevel,
    reason,
    releasedAt: typeof raw.releasedAt === "string" ? raw.releasedAt : null,
    platforms,
    title: parseLocalizedString(raw.title),
    highlights: parseLocalizedStringArray(raw.highlights),
    changelog: parseLocalizedString(raw.changelog),
    downloadUrl: parseDownloadUrl(raw.downloadUrl),
  };
}

function parseChannel(raw: unknown): ChannelManifest | null {
  if (!isObject(raw)) return null;

  const latestVersion = raw.latestVersion;
  if (
    typeof latestVersion !== "string" ||
    !VERSION_PATTERN.test(latestVersion)
  ) {
    return null;
  }

  const minSupportedVersion =
    typeof raw.minSupportedVersion === "string" &&
    VERSION_PATTERN.test(raw.minSupportedVersion)
      ? raw.minSupportedVersion
      : null;

  const releases: Release[] = [];
  if (Array.isArray(raw.releases)) {
    const seen = new Set<string>();
    for (const item of raw.releases) {
      const r = parseRelease(item);
      if (!r || seen.has(r.version)) continue;
      seen.add(r.version);
      releases.push(r);
    }
  }

  return { latestVersion, minSupportedVersion, releases };
}

function parseManifest(raw: unknown): UpdateManifest | null {
  if (!isObject(raw)) return null;
  if (raw.version !== SUPPORTED_VERSION) return null;
  if (!isObject(raw.channels)) return null;

  const channels: Record<string, ChannelManifest> = {};
  for (const [name, value] of Object.entries(raw.channels)) {
    const c = parseChannel(value);
    if (c) channels[name] = c;
  }
  if (Object.keys(channels).length === 0) return null;

  return {
    version: 1,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    channels,
  };
}

export function getCurrentChannel(): string {
  return Updates.channel || "production";
}

export async function fetchUpdateManifest(): Promise<UpdateManifest | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`${CONFIG_REPO_CDN}/update.json`, {
      signal: controller.signal,
    });
    // CDN fallback (e.g. jsdmirror 404 page) returns HTML with status 200 in
    // some edge cases — guard by status first, then JSON parse defensively so
    // missing manifests degrade silently to "no update" rather than throwing
    // into Sentry.
    if (!res.ok) return null;
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return null;
    }
    return parseManifest(data);
  } finally {
    clearTimeout(timer);
  }
}

export function isNetworkError(err: unknown): boolean {
  // Hermes (the RN JS engine) does not expose DOMException globally, so a
  // bare `instanceof DOMException` throws a ReferenceError before the caller
  // ever sees the original network failure. Guard the lookup defensively.
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

function isReleaseApplicable(release: Release): boolean {
  if (release.releasedAt) {
    const t = Date.parse(release.releasedAt);
    if (Number.isFinite(t) && Date.now() < t) return false;
  }
  if (release.platforms) {
    const cur = Platform.OS as UpdatePlatform;
    if (!release.platforms.includes(cur)) return false;
  }
  return true;
}

function mergeLevels(releases: Release[]): UpdateLevel {
  let max: UpdateLevel = "silent";
  for (const r of releases) {
    if (LEVEL_ORDER[r.level] > LEVEL_ORDER[max]) max = r.level;
  }
  return max;
}

// Prefer a `required`-level reason; fall back to any other non-null reason.
// (Both `find`s are short-circuited so the second only runs when no required
// release carried one — which shouldn't happen, since parseRelease drops
// required entries missing a reason.)
const pickReason = (releases: Release[]): LocalizedString | null =>
  releases.find((r) => r.level === "required" && r.reason)?.reason ??
  releases.find((r) => r.reason)?.reason ??
  null;

const pickDownloadUrl = (releases: Release[]): ReleaseDownloadUrl | null =>
  releases.find((r) => r.downloadUrl)?.downloadUrl ?? null;

const emptySummary = (latestVersion: string | null = null): UpdateSummary => ({
  hasUpdate: false,
  level: "silent",
  latestVersion,
  applicableReleases: [],
  blockedByMinVersion: false,
  reason: null,
  downloadUrl: null,
});

export function summarizeUpdate(
  manifest: UpdateManifest | null,
  channel: string,
  currentVersion: string,
): UpdateSummary {
  if (!manifest) return emptySummary();

  const ch = manifest.channels[channel] ?? manifest.channels.production;
  if (!ch) return emptySummary();

  const { latestVersion, minSupportedVersion, releases } = ch;

  if (compareVersions(currentVersion, latestVersion) >= 0) {
    return emptySummary(latestVersion);
  }

  const blockedByMinVersion =
    minSupportedVersion !== null &&
    compareVersions(currentVersion, minSupportedVersion) < 0;

  const applicable = releases
    .filter(
      (r) =>
        compareVersions(r.version, currentVersion) > 0 &&
        compareVersions(r.version, latestVersion) <= 0 &&
        isReleaseApplicable(r),
    )
    .sort((a, b) => compareVersions(b.version, a.version));

  return {
    hasUpdate: true,
    level: blockedByMinVersion ? "required" : mergeLevels(applicable),
    latestVersion,
    applicableReleases: applicable,
    blockedByMinVersion,
    reason: pickReason(applicable),
    downloadUrl: pickDownloadUrl(applicable),
  };
}

export function resolveLocalizedString(
  v: LocalizedString | null | undefined,
  lang: ResolvedLang,
): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  const exact = v[lang];
  if (typeof exact === "string" && exact.length > 0) return exact;
  const fallback = v.zh;
  return typeof fallback === "string" && fallback.length > 0 ? fallback : null;
}

export function resolveLocalizedStringArray(
  v: LocalizedStringArray | null | undefined,
  lang: ResolvedLang,
): string[] {
  if (v === null || v === undefined) return [];
  if (Array.isArray(v)) return v;
  const exact = v[lang];
  if (Array.isArray(exact)) return exact;
  const fallback = v.zh;
  return Array.isArray(fallback) ? fallback : [];
}

export function getCurrentAppVersion(): string {
  return Constants.expoConfig?.version ?? "0.0.0";
}
