import { create } from "zustand";
import { persist } from "zustand/middleware";

import { zustandStorage } from "@/lib/storage";

interface SettingsStore {
  hapticFeedback: boolean;
  openCourseOnLaunch: boolean;
  setHapticFeedback: (value: boolean) => void;
  setOpenCourseOnLaunch: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      hapticFeedback: true,
      openCourseOnLaunch: false,
      setHapticFeedback: (value: boolean) => set({ hapticFeedback: value }),
      setOpenCourseOnLaunch: (value: boolean) =>
        set({ openCourseOnLaunch: value }),
    }),
    {
      name: "settings",
      storage: zustandStorage,
    },
  ),
);
