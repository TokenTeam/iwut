import type { StoreApi } from "zustand";

import { useAnnouncementStore } from "./announcements";
import { useCourseStore } from "./course";
import { useDeveloperOptionsStore } from "./developer-options";
import { useExamStore } from "./exam";
import { useGradeStore } from "./grade";
import { useOnboardingStore } from "./onboarding";
import { useScheduleStore } from "./schedule";
import { useSettingsStore } from "./settings";
import { useThemeStore } from "./theme";
import { useUpdateStore } from "./update";
import { useUserBindStore } from "./user-bind";
import { useWlanStore } from "./wlan";

function resetStore<T>(
  store: StoreApi<T> & { persist: { clearStorage: () => void } },
) {
  store.setState(store.getInitialState(), true);
  store.persist.clearStorage();
}

export async function clearAllStoreData(): Promise<void> {
  await useUserBindStore.getState().unbind();
  await useWlanStore.getState().clear();

  resetStore(useSettingsStore);
  useSettingsStore.getState().setLanguage("system");
  useSettingsStore.persist.clearStorage();
  resetStore(useCourseStore);
  resetStore(useExamStore);
  resetStore(useGradeStore);
  resetStore(useScheduleStore);
  resetStore(useThemeStore);
  resetStore(useAnnouncementStore);
  resetStore(useUpdateStore);
  resetStore(useUserBindStore);
  resetStore(useWlanStore);
  resetStore(useOnboardingStore);
  resetStore(useDeveloperOptionsStore);
}
