import { create } from "zustand";
import { persist } from "zustand/middleware";

import { type Lang, setLang } from "@/lib/i18n";
import { zustandStorage } from "@/lib/storage";
import { setApplicationLocales } from "@/modules/locale";
import { reloadWidgets } from "@/modules/widget";
import { syncWidgetLang } from "@/services/widget-sync";

interface SettingsStore {
  hapticFeedback: boolean;
  openCourseOnLaunch: boolean;
  autoRefreshCourses: boolean;
  courseReminder: boolean;
  courseDnd: boolean;
  examReminder: boolean;
  reminderMinutes: number;
  calendarSync: boolean;
  syncedCalendarIds: string[];
  language: Lang;
  setHapticFeedback: (value: boolean) => void;
  setOpenCourseOnLaunch: (value: boolean) => void;
  setAutoRefreshCourses: (value: boolean) => void;
  setCourseReminder: (value: boolean) => void;
  setCourseDnd: (value: boolean) => void;
  setExamReminder: (value: boolean) => void;
  setReminderMinutes: (value: number) => void;
  setCalendarSync: (value: boolean) => void;
  setSyncedCalendarIds: (ids: string[]) => void;
  setLanguage: (value: Lang) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      hapticFeedback: true,
      openCourseOnLaunch: false,
      autoRefreshCourses: false,
      courseReminder: false,
      courseDnd: false,
      examReminder: false,
      reminderMinutes: 30,
      calendarSync: false,
      syncedCalendarIds: [],
      language: "system",
      setHapticFeedback: (value: boolean) => set({ hapticFeedback: value }),
      setOpenCourseOnLaunch: (value: boolean) =>
        set({ openCourseOnLaunch: value }),
      setAutoRefreshCourses: (value: boolean) =>
        set({ autoRefreshCourses: value }),
      setCourseReminder: (value: boolean) => set({ courseReminder: value }),
      setCourseDnd: (value: boolean) => set({ courseDnd: value }),
      setExamReminder: (value: boolean) => set({ examReminder: value }),
      setReminderMinutes: (value: number) => set({ reminderMinutes: value }),
      setCalendarSync: (value: boolean) => set({ calendarSync: value }),
      setSyncedCalendarIds: (ids: string[]) => set({ syncedCalendarIds: ids }),
      setLanguage: (value: Lang) => {
        set({ language: value });
        const tag = value === "zh" ? "zh-Hans" : value === "en" ? "en" : null;
        void setApplicationLocales(tag).catch(() => {
          // 原生模块不可用时，仍更新应用内翻译
        });
        setLang(value);
        void syncWidgetLang()
          .then(() => reloadWidgets())
          .catch(() => {
            // 部分构建不包含小组件模块
          });
      },
    }),
    {
      name: "settings",
      storage: zustandStorage,
      onRehydrateStorage: () => (state) => {
        if (state?.language) {
          setLang(state.language);
          // 冷启动时恢复应用语言覆盖
          const tag =
            state.language === "zh"
              ? "zh-Hans"
              : state.language === "en"
                ? "en"
                : null;
          void setApplicationLocales(tag).catch(() => {});
        }
      },
    },
  ),
);
