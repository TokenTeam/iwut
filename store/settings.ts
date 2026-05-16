import { create } from "zustand";
import { persist } from "zustand/middleware";

import { type Lang, setLang } from "@/lib/i18n";
import { zustandStorage } from "@/lib/storage";

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
        setLang(value);
      },
    }),
    {
      name: "settings",
      storage: zustandStorage,
      onRehydrateStorage: () => (state) => {
        if (state?.language) setLang(state.language);
      },
    },
  ),
);
