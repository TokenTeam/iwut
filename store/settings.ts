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
  courseReminder: boolean;
  reminderMinutes: number;
  calendarSync: boolean;
  language: Lang;
  setHapticFeedback: (value: boolean) => void;
  setOpenCourseOnLaunch: (value: boolean) => void;
  setCourseReminder: (value: boolean) => void;
  setReminderMinutes: (value: number) => void;
  setCalendarSync: (value: boolean) => void;
  setLanguage: (value: Lang) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      hapticFeedback: true,
      openCourseOnLaunch: false,
      courseReminder: false,
      reminderMinutes: 30,
      calendarSync: false,
      language: "system",
      setHapticFeedback: (value: boolean) => set({ hapticFeedback: value }),
      setOpenCourseOnLaunch: (value: boolean) =>
        set({ openCourseOnLaunch: value }),
      setCourseReminder: (value: boolean) => set({ courseReminder: value }),
      setReminderMinutes: (value: number) => set({ reminderMinutes: value }),
      setCalendarSync: (value: boolean) => set({ calendarSync: value }),
      setLanguage: (value: Lang) => {
        set({ language: value });
        // Sync OS-level locale first so the App display name (launcher icon
        // label) and system permission dialogs follow the in-app choice.
        // "system" clears the override and falls back to the device language.
        const tag = value === "zh" ? "zh-Hans" : value === "en" ? "en" : null;
        void setApplicationLocales(tag).catch(() => {
          // Native module unavailable in some environments (e.g. Expo Go);
          // RN-side translations still work, the native surfaces just stay
          // on the previous OS locale.
        });
        // Resolve and notify RN-side listeners. `setLang("system")` reads the
        // device-level locale via the native module, so it does not depend on
        // the async `setApplicationLocales` call above having completed.
        setLang(value);
        // Push the resolved language to native widgets and refresh them so
        // their text matches the new language immediately.
        void syncWidgetLang()
          .then(() => reloadWidgets())
          .catch(() => {
            // Widget module may not be available in every build target.
          });
      },
    }),
    {
      name: "settings",
      storage: zustandStorage,
      onRehydrateStorage: () => (state) => {
        if (state?.language) {
          setLang(state.language);
          // Re-apply the OS-level override on every cold start so the launcher
          // label / permission dialogs stay aligned with the user's in-app
          // choice (Android persists per-app locales itself, but iOS reads
          // AppleLanguages from UserDefaults which we manage here).
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
