import enJson from "./locales/en.json";
import zhJson from "./locales/zh.json";

type WidenStrings<T> = T extends string
  ? string
  : T extends object
    ? { [K in keyof T]: WidenStrings<T[K]> }
    : T;

export type Dict = WidenStrings<typeof zhJson>;

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

interface LanguageDefinition {
  messages: Dict;
  nativeTag: string;
  formatLocale: string;
  labelKey: TKey;
  formatDate: (date: Date) => string;
}

export const languages = {
  zh: {
    messages: zhJson,
    nativeTag: "zh-Hans",
    formatLocale: "zh-CN",
    labelKey: "appearance.langZh",
    formatDate: (date: Date) =>
      `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`,
  },
  en: {
    messages: enJson,
    nativeTag: "en",
    formatLocale: "en-US",
    labelKey: "appearance.langEn",
    formatDate(date: Date) {
      return date.toLocaleDateString(this.formatLocale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    },
  },
} as const satisfies Record<string, LanguageDefinition>;

export type ResolvedLang = keyof typeof languages;
export type Lang = ResolvedLang | "system";

export const BASE_LOCALE: ResolvedLang = "zh";
export const UNSUPPORTED_SYSTEM_LOCALE: ResolvedLang = "en";
export const SYSTEM_LOCALE_READ_FALLBACK: ResolvedLang = BASE_LOCALE;
export const supportedLanguages = Object.keys(languages) as ResolvedLang[];

export function isResolvedLang(value: unknown): value is ResolvedLang {
  return typeof value === "string" && Object.hasOwn(languages, value);
}

export function isLang(value: unknown): value is Lang {
  return value === "system" || isResolvedLang(value);
}

export function resolveLanguageTag(tag: string): ResolvedLang {
  const normalized = tag.toLowerCase().replaceAll("_", "-");
  if (isResolvedLang(normalized)) return normalized;
  const code = normalized.split("-")[0];
  return isResolvedLang(code) ? code : UNSUPPORTED_SYSTEM_LOCALE;
}

export function getNativeLanguageTag(lang: Lang): string | null {
  return lang === "system" ? null : languages[lang].nativeTag;
}
