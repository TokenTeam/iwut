import { getMMKV } from "@/lib/storage";

import { type Lang, setLang } from "./index";

function readSavedLanguage(): Lang | null {
  try {
    const raw = getMMKV().getString("settings");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { language?: unknown } };
    const lang = parsed?.state?.language;
    if (lang === "zh" || lang === "en" || lang === "system") {
      return lang;
    }
  } catch {
    // Ignore malformed persisted state; fall through to system default.
  }
  return null;
}

// Synchronous: MMKV reads are sync, so this runs before any component renders.
setLang(readSavedLanguage() ?? "system");
