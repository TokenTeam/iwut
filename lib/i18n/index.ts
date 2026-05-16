import { getLocales } from "expo-localization";
import { useSyncExternalStore } from "react";

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

const dicts: Record<ResolvedLang, Dict> = {
  zh: zhJson as Dict,
  en: enJson,
};

function resolveSystem(): ResolvedLang {
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

export function t(key: TKey, vars?: Record<string, string | number>): string {
  const dict = dicts[currentResolved];
  const raw =
    getByPath(dict, key) ?? getByPath(dicts.zh, key) ?? (key as string);
  return interpolate(raw, vars);
}

export function useT(): typeof t {
  // Prevent React Compiler from wrapping the returned closure in an implicit
  // useMemo. We *want* a fresh function reference per render (see comment
  // below); auto-memoization would defeat the entire purpose of this hook.
  "use no memo";
  const lang = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => currentResolved,
    () => currentResolved,
  );
  // Return a fresh closure on every render. This is intentional and required
  // because React Compiler (`reactCompiler: true` in app.config.ts) memoizes
  // expressions like `t("some.key")` based on the identity of `t`. If `t`
  // had a stable identity (e.g. by returning the module-level `t` or a
  // useMemo-cached wrapper), the compiler may hoist or cache call results
  // forever and language switches would never propagate to consumers.
  // Producing a fresh function reference per render guarantees those cached
  // expressions are invalidated. The closure captures the `lang` primitive
  // resolved at render time so all dict lookups resolve to the current
  // language at call time, without re-reading module-level mutable state.
  // Refs: facebook/react#29195, i18next/react-i18next#1863 + PR #1884.
  const dict = dicts[lang];
  return ((key, vars) => {
    const raw =
      getByPath(dict, key) ?? getByPath(dicts.zh, key) ?? (key as string);
    return interpolate(raw, vars);
  }) as typeof t;
}
