import { CONFIG_REPO_CDN } from "@/constants/api";

export type LocalizedString = string | Partial<Record<"zh" | "en", string>>;

export interface FunctionWebApp {
  id: string;
  label: LocalizedString;
  icon: string;
  color: string;
  uri?: string;
  route?: string;
  lan?: boolean;
}

export interface FunctionSection {
  id: string;
  title: LocalizedString;
  items: FunctionWebApp[];
}

export interface FunctionAppsManifest {
  version: 1;
  updatedAt: string | null;
  sections: FunctionSection[];
}

const SUPPORTED_VERSION = 1;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const ROUTE_ALLOWLIST = new Set(["/grade", "/exam"]);

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseLocalizedString(raw: unknown): LocalizedString | null {
  if (typeof raw === "string") {
    return raw.length > 0 ? raw : null;
  }

  if (!isObject(raw)) return null;

  const out: Partial<Record<"zh" | "en", string>> = {};

  if (typeof raw.zh === "string" && raw.zh.length > 0) {
    out.zh = raw.zh;
  }

  if (typeof raw.en === "string" && raw.en.length > 0) {
    out.en = raw.en;
  }

  return out.zh ? out : null;
}

function parseWebApp(raw: unknown): FunctionWebApp | null {
  if (!isObject(raw)) return null;
  if (raw.enabled === false) return null;

  const id = raw.id;
  if (typeof id !== "string" || !ID_PATTERN.test(id)) return null;

  const label = parseLocalizedString(raw.label);
  if (!label) return null;

  const icon = raw.icon;
  if (typeof icon !== "string" || icon.length === 0) return null;

  const color = raw.color;
  if (typeof color !== "string" || !COLOR_PATTERN.test(color)) return null;

  const route = raw.route;
  const uri = raw.uri;
  const validRoute =
    typeof route === "string" && ROUTE_ALLOWLIST.has(route) ? route : null;
  const validUri =
    typeof uri === "string" && /^https?:\/\//.test(uri) ? uri : null;

  // route 与 uri 必须二选一：两个都缺、或两个都填，都判非法
  if ((validRoute === null) === (validUri === null)) return null;

  return {
    id,
    label,
    icon,
    color,
    route: validRoute ?? undefined,
    uri: validUri ?? undefined,
    lan: raw.lan === true,
  };
}

function parseSection(raw: unknown): FunctionSection | null {
  if (!isObject(raw)) return null;
  if (raw.enabled === false) return null;

  const id = raw.id;
  if (typeof id !== "string" || !ID_PATTERN.test(id)) return null;

  const title = parseLocalizedString(raw.title);
  if (!title) return null;

  if (!Array.isArray(raw.items)) return null;

  const items: FunctionWebApp[] = [];
  const seenIds = new Set<string>();

  for (const item of raw.items) {
    const app = parseWebApp(item);
    if (!app || seenIds.has(app.id)) continue;

    seenIds.add(app.id);
    items.push(app);
  }

  if (items.length === 0) return null;

  return {
    id,
    title,
    items,
  };
}

function parseManifest(raw: unknown): FunctionAppsManifest | null {
  if (!isObject(raw)) return null;
  if (raw.version !== SUPPORTED_VERSION) return null;
  if (!Array.isArray(raw.sections)) return null;

  const sections: FunctionSection[] = [];
  const seenIds = new Set<string>();

  for (const item of raw.sections) {
    const section = parseSection(item);
    if (!section || seenIds.has(section.id)) continue;

    seenIds.add(section.id);
    sections.push(section);
  }

  if (sections.length === 0) return null;

  return {
    version: 1,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    sections,
  };
}

export async function fetchFunctionAppsManifest(): Promise<FunctionAppsManifest | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`${CONFIG_REPO_CDN}/function-apps.json`, {
      signal: controller.signal,
    });

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