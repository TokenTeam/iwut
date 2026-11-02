import { getMMKV } from "@/lib/storage";

import { isLang, type Lang, setLang } from "./index";

function readSavedLanguage(): Lang | null {
  try {
    const raw = getMMKV().getString("settings");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { language?: unknown } };
    const lang = parsed?.state?.language;
    if (isLang(lang)) {
      return lang;
    }
  } catch {
    // 持久化数据无效时跟随系统
  }
  return null;
}

// 首次渲染前同步恢复语言
setLang(readSavedLanguage() ?? "system");
