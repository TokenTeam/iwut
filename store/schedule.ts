import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  BUILTIN_PALETTES,
  type ColorPalette,
} from "@/constants/course-palettes";
import { zustandStorage } from "@/lib/storage";

export interface ScheduleVisualSettings {
  backgroundImageOpacity: number;
  backgroundImageBlurRadius: number;
  courseCellOpacity: number;
  otherWeekCellOpacity: number;
  locatorCellOpacity: number;
}

export const DEFAULT_SCHEDULE_VISUAL: ScheduleVisualSettings = {
  backgroundImageOpacity: 0.25,
  backgroundImageBlurRadius: 0,
  courseCellOpacity: 1,
  otherWeekCellOpacity: 0.14,
  locatorCellOpacity: 1,
};

const SCHEDULE_PERSIST_VERSION = 1;

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function migrateScheduleState(persistedState: unknown, version: number) {
  if (
    version >= SCHEDULE_PERSIST_VERSION ||
    typeof persistedState !== "object" ||
    persistedState === null
  ) {
    return persistedState;
  }

  const state = persistedState as Partial<ScheduleStore>;
  const oldLocatorOpacity =
    typeof state.locatorCellOpacity === "number"
      ? state.locatorCellOpacity
      : DEFAULT_SCHEDULE_VISUAL.locatorCellOpacity;

  return {
    ...state,
    locatorCellOpacity: clampUnit(oldLocatorOpacity / 0.08),
  };
}

interface ScheduleStore {
  scrollWeekend: boolean;
  showMiddaySections: boolean;
  showOtherWeekCourses: boolean;
  colorPalette: ColorPalette;
  customPalettes: ColorPalette[];
  courseColorOverrides: Record<string, string>;
  backgroundImageUri: string | null;
  backgroundImageOpacity: number;
  backgroundImageBlurRadius: number;
  courseCellOpacity: number;
  otherWeekCellOpacity: number;
  locatorCellOpacity: number;
  setScrollWeekend: (value: boolean) => void;
  setShowMiddaySections: (value: boolean) => void;
  setShowOtherWeekCourses: (value: boolean) => void;
  setColorPalette: (palette: ColorPalette) => void;
  addCustomPalette: (palette: ColorPalette) => void;
  removeCustomPalette: (name: string) => void;
  setCourseColorOverride: (name: string, color: string) => void;
  removeCourseColorOverride: (name: string) => void;
  setBackgroundImageUri: (uri: string | null) => void;
  setBackgroundImageOpacity: (value: number) => void;
  setBackgroundImageBlurRadius: (value: number) => void;
  setCourseCellOpacity: (value: number) => void;
  setOtherWeekCellOpacity: (value: number) => void;
  setLocatorCellOpacity: (value: number) => void;
  resetScheduleVisual: () => void;
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
      ...DEFAULT_SCHEDULE_VISUAL,
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
      setBackgroundImageOpacity: (value: number) =>
        set({ backgroundImageOpacity: value }),
      setBackgroundImageBlurRadius: (value: number) =>
        set({ backgroundImageBlurRadius: value }),
      setCourseCellOpacity: (value: number) =>
        set({ courseCellOpacity: value }),
      setOtherWeekCellOpacity: (value: number) =>
        set({ otherWeekCellOpacity: value }),
      setLocatorCellOpacity: (value: number) =>
        set({ locatorCellOpacity: value }),
      resetScheduleVisual: () => set({ ...DEFAULT_SCHEDULE_VISUAL }),
    }),
    {
      name: "schedule",
      storage: zustandStorage,
      version: SCHEDULE_PERSIST_VERSION,
      migrate: migrateScheduleState,
    },
  ),
);
