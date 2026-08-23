import { getLocales } from "expo-localization";
import { useCallback, useSyncExternalStore } from "react";

import { getSystemLanguageTag } from "@/modules/locale";

import enJson from "./locales/en.json";
import zhJson from "./locales/zh.json";

export type Lang = "zh" | "en" | "system";
export type ResolvedLang = "zh" | "en";

type WidenStrings<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? readonly WidenStrings<U>[]
    : T extends object
      ? { [K in keyof T]: WidenStrings<T[K]> }
      : T;

export type Dict = WidenStrings<typeof zhJson>;

// Compile-time check: en must structurally match zh.
const _enCheck: Dict = enJson;
void _enCheck;

type Leaves<T, P extends string = ""> = T extends string
  ? P extends `${infer Head}.`
    ? Head
    : never
  : T extends object
    ? {
        [K in keyof T & string]: Leaves<T[K], `${P}${K}.`>;
      }[keyof T & string]
    : never;

export type TKey = Leaves<Dict>;
export type Translator = (
  key: TKey,
  vars?: Record<string, string | number>,
) => string;

const dicts: Record<ResolvedLang, Dict> = {
  zh: zhJson as Dict,
  en: enJson,
};

function resolveSystem(): ResolvedLang {
  // Prefer the native module which reads the *device-level* locale via
  // `Resources.getSystem()` / CFPreferences global domain. This bypasses our
  // own per-app override and is the only way to correctly resolve "follow
  // system" right after switching away from an explicit language.
  try {
    const nativeTag = getSystemLanguageTag();
    if (nativeTag) {
      return nativeTag.toLowerCase().startsWith("zh") ? "zh" : "en";
    }
  } catch {
    // Fall through to the expo-localization based path below.
  }
  try {
    const code = getLocales().at(0)?.languageCode ?? "zh";
    return code === "zh" ? "zh" : "en";
  } catch {
    return "zh";
  }
}

let currentLang: Lang = "system";
let currentResolved: ResolvedLang = resolveSystem();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getResolvedLangSnapshot(): ResolvedLang {
  return currentResolved;
}

function notify() {
  for (const l of listeners) l();
}

export function setLang(lang: Lang): void {
  const resolved: ResolvedLang = lang === "system" ? resolveSystem() : lang;
  const changed = lang !== currentLang || resolved !== currentResolved;
  currentLang = lang;
  currentResolved = resolved;
  if (changed) notify();
}

export function getLang(): Lang {
  return currentLang;
}

export function getResolvedLang(): ResolvedLang {
  return currentResolved;
}

export function refreshSystemLocale(): void {
  if (currentLang !== "system") return;
  const resolved = resolveSystem();
  if (resolved !== currentResolved) {
    currentResolved = resolved;
    notify();
  }
}

function getByPath(obj: unknown, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (
      cur &&
      typeof cur === "object" &&
      p in (cur as Record<string, unknown>)
    ) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return typeof cur === "string" ? cur : undefined;
}

function interpolate(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    k in vars ? String(vars[k as keyof typeof vars]) : `{${k}}`,
  );
}

function translateWithLang(
  lang: ResolvedLang,
  key: TKey,
  vars?: Record<string, string | number>,
): string {
  const dict = dicts[lang];
  const raw =
    getByPath(dict, key) ?? getByPath(dicts.zh, key) ?? (key as string);
  return interpolate(raw, vars);
}

export function t(key: TKey, vars?: Record<string, string | number>): string {
  return translateWithLang(currentResolved, key, vars);
}

/** 订阅当前已解析语言 */
export function useResolvedLang(): ResolvedLang {
  return useSyncExternalStore(
    subscribe,
    getResolvedLangSnapshot,
    getResolvedLangSnapshot,
  );
}

/**
 * 返回绑定到当前语言的 translator。
 * 同一语言下引用稳定，语言变化时引用同步变化，兼顾 React Compiler 与 memo。
 */
export function useT(): Translator {
  const lang = useResolvedLang();
  return useCallback<Translator>(
    (key, vars) => translateWithLang(lang, key, vars),
    [lang],
  );
}
