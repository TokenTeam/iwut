import { create } from "zustand";

export interface TabViewport {
  width: number;
  height: number;
  bottomInset: number;
}

export function getWarmupBottomInset(
  viewport: TabViewport | null,
  width: number,
  height: number,
): number | null {
  if (
    !viewport ||
    width <= 0 ||
    height <= 0 ||
    viewport.width !== width ||
    viewport.height !== height
  ) {
    return null;
  }
  return viewport.bottomInset;
}

interface StartupStore {
  tabsRequested: boolean;
  homeReady: boolean;
  courseReady: boolean;
  viewport: TabViewport | null;
  setViewport: (viewport: TabViewport) => void;
  requestTabs: () => void;
  markHomeReady: () => void;
  markCourseReady: () => void;
}

export const useStartupStore = create<StartupStore>((set) => ({
  tabsRequested: false,
  homeReady: false,
  courseReady: false,
  viewport: null,
  setViewport: (viewport) =>
    set((previous) => {
      if (
        !Number.isFinite(viewport.width) ||
        !Number.isFinite(viewport.height) ||
        !Number.isFinite(viewport.bottomInset) ||
        viewport.width <= 0 ||
        viewport.height <= 0 ||
        viewport.bottomInset <= 0 ||
        viewport.bottomInset >= viewport.height ||
        (previous.viewport?.width === viewport.width &&
          previous.viewport.height === viewport.height &&
          previous.viewport.bottomInset === viewport.bottomInset)
      ) {
        return previous;
      }
      return { viewport };
    }),
  requestTabs: () =>
    set((state) => (state.tabsRequested ? state : { tabsRequested: true })),
  markHomeReady: () =>
    set((state) => (state.homeReady ? state : { homeReady: true })),
  markCourseReady: () =>
    set((state) => (state.courseReady ? state : { courseReady: true })),
}));
