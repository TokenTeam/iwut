import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  BUILTIN_PALETTES,
  type ColorPalette,
} from "@/constants/course-palettes";
import { zustandStorage } from "@/lib/storage";

interface ScheduleStore {
  scrollWeekend: boolean;
  showMiddaySections: boolean;
  showOtherWeekCourses: boolean;
  colorPalette: ColorPalette;
  customPalettes: ColorPalette[];
  courseColorOverrides: Record<string, string>;
  backgroundImageUri: string | null;
  setScrollWeekend: (value: boolean) => void;
  setShowMiddaySections: (value: boolean) => void;
  setShowOtherWeekCourses: (value: boolean) => void;
  setColorPalette: (palette: ColorPalette) => void;
  addCustomPalette: (palette: ColorPalette) => void;
  removeCustomPalette: (name: string) => void;
  setCourseColorOverride: (name: string, color: string) => void;
  removeCourseColorOverride: (name: string) => void;
  setBackgroundImageUri: (uri: string | null) => void;
}

export const useScheduleStore = create<ScheduleStore>()(
  persist(
    (set, get) => ({
      scrollWeekend: true,
      showMiddaySections: false,
      showOtherWeekCourses: true,
      colorPalette: BUILTIN_PALETTES[0],
      customPalettes: [],
      courseColorOverrides: {},
      backgroundImageUri: null,
      setScrollWeekend: (value: boolean) => set({ scrollWeekend: value }),
      setShowMiddaySections: (value: boolean) =>
        set({ showMiddaySections: value }),
      setShowOtherWeekCourses: (value: boolean) =>
        set({ showOtherWeekCourses: value }),
      setColorPalette: (palette: ColorPalette) =>
        set({ colorPalette: palette }),
      addCustomPalette: (palette: ColorPalette) =>
        set({
          customPalettes: [
            ...get().customPalettes.filter((p) => p.name !== palette.name),
            palette,
          ],
        }),
      removeCustomPalette: (name: string) =>
        set({
          customPalettes: get().customPalettes.filter((p) => p.name !== name),
        }),
      setCourseColorOverride: (name: string, color: string) =>
        set({
          courseColorOverrides: {
            ...get().courseColorOverrides,
            [name]: color,
          },
        }),
      removeCourseColorOverride: (name: string) => {
        const { [name]: _, ...rest } = get().courseColorOverrides;
        set({ courseColorOverrides: rest });
      },
      setBackgroundImageUri: (uri: string | null) =>
        set({ backgroundImageUri: uri }),
    }),
    {
      name: "schedule",
      storage: zustandStorage,
    },
  ),
);
