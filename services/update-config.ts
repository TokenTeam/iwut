import * as Application from "expo-application";
import * as Updates from "expo-updates";
import { Platform } from "react-native";

import { CONFIG_REPO_CDN } from "@/constants/api";
import type { ResolvedLang } from "@/lib/i18n";
import { isInRollout, type Rollout } from "@/lib/update-rollout";
import { compareVersions } from "@/lib/version";

export type UpdateLevel = "silent" | "recommended" | "required";
type UpdatePlatform = "ios" | "android" | "web";

export interface UpdateContext {
  platform: UpdatePlatform;
  deviceId: string | null;
  now: number;
}

export type LocalizedString = string | Partial<Record<string, string>>;
export type LocalizedStringArray = string[] | Partial<Record<string, string[]>>;

export interface ReleaseDownloadUrl {
  ios: string | null;
  android: string | null;
}

export interface Release {
  version: string;
  departed: boolean;
  level: UpdateLevel;
  reason: LocalizedString | null;
  releasedAt: string | null;
  platforms: UpdatePlatform[] | null;
  title: LocalizedString | null;
  highlights: LocalizedStringArray | null;
  changelog: LocalizedString | null;
  downloadUrl: ReleaseDownloadUrl | null;
}

export interface ManifestRelease extends Release {
  rollout: { android: Rollout } | null;
}

interface ChannelManifest {
  latestVersion: string;
  minSupportedVersion: string | null;
  releases: ManifestRelease[];
}

export interface UpdateManifest {
  version: 1;
  updatedAt: string | null;
  channels: Record<string, ChannelManifest>;
}

export interface UpdateSummary {
  channel: string | null;
  hasUpdate: boolean;
  level: UpdateLevel;
  latestVersion: string | null;
  applicableReleases: Release[];
  blockedByMinVersion: boolean;
  blockedByDeparted: boolean;
  reason: LocalizedString | null;
  downloadUrl: ReleaseDownloadUrl | null;
  isRollout: boolean;
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

function isValidReleaseDate(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
  ) {
    return false;
  }
  const time = Date.parse(value);
  return (
    Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 19) === value.slice(0, 19)
  );
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

function parseRelease(raw: unknown): ManifestRelease | null {
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
  if (level === "required" && reason === null) return null;
  if (
    raw.releasedAt !== undefined &&
    raw.releasedAt !== null &&
    !isValidReleaseDate(raw.releasedAt)
  ) {
    return null;
  }

  let rollout: ManifestRelease["rollout"] = null;
  if (raw.rollout !== undefined && raw.rollout !== null) {
    if (!isObject(raw.rollout) || !isObject(raw.rollout.android)) return null;
    const { percentage, seed } = raw.rollout.android;
    if (
      typeof percentage !== "number" ||
      !Number.isFinite(percentage) ||
      percentage < 0 ||
      percentage > 100 ||
      typeof seed !== "string" ||
      seed.trim().length === 0
    ) {
      return null;
    }
    if (percentage < 100 && (level === "required" || raw.departed === true)) {
      return null;
    }
    rollout = { android: { percentage, seed } };
  }

  let platforms: UpdatePlatform[] | null = null;
  if (raw.platforms !== undefined && raw.platforms !== null) {
    if (!Array.isArray(raw.platforms)) return null;
    if (
      !raw.platforms.every(
        (p): p is UpdatePlatform =>
          typeof p === "string" && VALID_PLATFORMS.has(p as UpdatePlatform),
      )
    ) {
      return null;
    }
    platforms = Array.from(new Set<UpdatePlatform>(raw.platforms));
  }

  return {
    version,
    departed: raw.departed === true,
    level: level as UpdateLevel,
    reason,
    releasedAt: typeof raw.releasedAt === "string" ? raw.releasedAt : null,
    platforms,
    title: parseLocalizedString(raw.title),
    highlights: parseLocalizedStringArray(raw.highlights),
    changelog: parseLocalizedString(raw.changelog),
    downloadUrl: parseDownloadUrl(raw.downloadUrl),
    rollout,
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

  let minSupportedVersion: string | null = null;
  if (
    raw.minSupportedVersion !== undefined &&
    raw.minSupportedVersion !== null
  ) {
    if (
      typeof raw.minSupportedVersion !== "string" ||
      !VERSION_PATTERN.test(raw.minSupportedVersion)
    ) {
      return null;
    }
    minSupportedVersion = raw.minSupportedVersion;
  }

  if (!Array.isArray(raw.releases)) return null;
  const releases: ManifestRelease[] = [];
  const seen = new Set<string>();
  for (const item of raw.releases) {
    const r = parseRelease(item);
    if (!r) return null;
    if (seen.has(r.version)) continue;
    seen.add(r.version);
    releases.push(r);
  }

  return { latestVersion, minSupportedVersion, releases };
}

export function parseUpdateManifest(raw: unknown): UpdateManifest | null {
  if (!isObject(raw)) return null;
  if (raw.version !== SUPPORTED_VERSION) return null;
  if (!isObject(raw.channels)) return null;

  const channels: Record<string, ChannelManifest> = {};
  for (const [name, value] of Object.entries(raw.channels)) {
    const c = parseChannel(value);
    if (!c) return null;
    channels[name] = c;
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
    // 检查失败时保留上次有效状态
    if (!res.ok) return null;
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return null;
    }
    return parseUpdateManifest(data);
  } finally {
    clearTimeout(timer);
  }
}

export function getUpdateContext(): UpdateContext {
  const platform = Platform.OS as UpdatePlatform;
  let deviceId: string | null = null;
  if (platform === "android") {
    try {
      deviceId = Application.getAndroidId() || null;
    } catch {
      // 无设备标识时仅允许全量更新
    }
  }
  return { platform, deviceId, now: Date.now() };
}

function isReleaseApplicable(
  release: Release,
  context: UpdateContext,
): boolean {
  if (release.releasedAt) {
    const t = Date.parse(release.releasedAt);
    if (Number.isFinite(t) && context.now < t) return false;
  }
  if (release.platforms) {
    if (!release.platforms.includes(context.platform)) return false;
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

function isReleaseEligible(
  release: ManifestRelease,
  context: UpdateContext,
): boolean {
  return (
    !release.departed &&
    (context.platform !== "android" ||
      isInRollout(release.rollout?.android, context.deviceId))
  );
}

function isPartialRollout(
  release: ManifestRelease,
  context: UpdateContext,
): boolean {
  return (
    context.platform === "android" &&
    release.rollout !== null &&
    release.rollout.android.percentage < 100
  );
}

const pickReason = (releases: Release[]): LocalizedString | null =>
  releases.find((r) => r.level === "required" && r.reason)?.reason ??
  releases.find((r) => r.reason)?.reason ??
  null;

const emptySummary = (latestVersion: string | null = null): UpdateSummary => ({
  channel: null,
  hasUpdate: false,
  level: "silent",
  latestVersion,
  applicableReleases: [],
  blockedByMinVersion: false,
  blockedByDeparted: false,
  reason: null,
  downloadUrl: null,
  isRollout: false,
});

export function summarizeUpdate(
  manifest: UpdateManifest | null,
  channel: string,
  currentVersion: string,
  context: UpdateContext = getUpdateContext(),
): UpdateSummary {
  if (!manifest) return emptySummary();

  const resolvedChannel = Object.hasOwn(manifest.channels, channel)
    ? channel
    : "production";
  const ch = manifest.channels[resolvedChannel];
  if (!ch) return emptySummary();

  const { latestVersion, minSupportedVersion, releases } = ch;

  const blockedByMinVersion =
    minSupportedVersion !== null &&
    compareVersions(currentVersion, minSupportedVersion) < 0;
  const departedRelease = releases.find(
    (r) =>
      r.departed &&
      compareVersions(r.version, currentVersion) === 0 &&
      isReleaseApplicable(r, context),
  );
  const blockedByDeparted = departedRelease !== undefined;

  const applicable = releases
    .filter(
      (r) =>
        compareVersions(r.version, currentVersion) > 0 &&
        compareVersions(r.version, latestVersion) <= 0 &&
        isReleaseApplicable(r, context),
    )
    .sort((a, b) => compareVersions(b.version, a.version));

  const eligible = applicable.filter((r) => isReleaseEligible(r, context));
  const target = eligible.find(
    (r) =>
      (!isPartialRollout(r, context) ||
        (!blockedByMinVersion &&
          !blockedByDeparted &&
          !eligible.some(
            (previous) =>
              compareVersions(previous.version, r.version) <= 0 &&
              previous.level === "required",
          ))) &&
      (!blockedByMinVersion ||
        (minSupportedVersion !== null &&
          compareVersions(r.version, minSupportedVersion) >= 0)),
  );
  if (!target) {
    return emptySummary();
  }
  const includedReleases = applicable.filter(
    (r) => compareVersions(r.version, target.version) <= 0,
  );
  // 未命中的灰度版本仅合并日志
  const policyReleases = includedReleases.filter((r) =>
    isReleaseEligible(r, context),
  );

  return {
    channel: resolvedChannel,
    hasUpdate: true,
    level:
      blockedByMinVersion || blockedByDeparted
        ? "required"
        : mergeLevels(policyReleases),
    latestVersion: target.version,
    applicableReleases: includedReleases.map(
      ({ rollout: _rollout, ...r }) => r,
    ),
    blockedByMinVersion,
    blockedByDeparted,
    reason: departedRelease?.reason ?? pickReason(policyReleases),
    downloadUrl: target.downloadUrl,
    isRollout: isPartialRollout(target, context),
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
  return Application.nativeApplicationVersion ?? "0.0.0";
}
