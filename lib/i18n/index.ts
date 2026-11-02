import { getLocales } from "expo-localization";
import { useCallback, useSyncExternalStore } from "react";

import { getSystemLanguageTag } from "@/modules/locale";

import {
  BASE_LOCALE,
  languages,
  resolveLanguageTag,
  SYSTEM_LOCALE_READ_FALLBACK,
  type Lang,
  type ResolvedLang,
  type TKey,
} from "./languages";

export * from "./languages";
export type Translator = (
  key: TKey,
  vars?: Record<string, string | number>,
) => string;

function resolveSystem(): ResolvedLang {
  // 绕过应用语言覆盖，读取设备语言
  try {
    const nativeTag = getSystemLanguageTag();
    if (nativeTag) {
      return resolveLanguageTag(nativeTag);
    }
  } catch {
    // 回退到 expo-localization
  }
  try {
    const locale = getLocales().at(0);
    const tag = locale?.languageTag ?? locale?.languageCode;
    return tag ? resolveLanguageTag(tag) : SYSTEM_LOCALE_READ_FALLBACK;
  } catch {
    return SYSTEM_LOCALE_READ_FALLBACK;
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
  const dict = languages[lang].messages;
  const raw =
    getByPath(dict, key) ??
    getByPath(languages[BASE_LOCALE].messages, key) ??
    (key as string);
  return interpolate(raw, vars);
}

export function t(key: TKey, vars?: Record<string, string | number>): string {
  return translateWithLang(currentResolved, key, vars);
}

export function useResolvedLang(): ResolvedLang {
  return useSyncExternalStore(
    subscribe,
    getResolvedLangSnapshot,
    getResolvedLangSnapshot,
  );
}

export function useT(): Translator {
  const lang = useResolvedLang();
  return useCallback<Translator>(
    (key, vars) => translateWithLang(lang, key, vars),
    [lang],
  );
}
