import { create } from "zustand";
import { persist } from "zustand/middleware";

import { reportError } from "@/lib/report";
import { zustandStorage } from "@/lib/storage";
import {
  fetchFunctionAppsManifest,
  isNetworkError,
  type FunctionSection,
} from "@/services/function-apps";

const MIN_FETCH_INTERVAL_MS = 5 * 60 * 1000;

interface FunctionAppsStore {
  sections: FunctionSection[];
  fetching: boolean;
  fetchedAt: number | null;
  fetch: (options?: { force?: boolean }) => Promise<void>;
}

export const useFunctionAppsStore = create<FunctionAppsStore>()(
  persist(
    (set, get) => ({
      sections: [],
      fetching: false,
      fetchedAt: null,

      fetch: async (options) => {
        if (get().fetching) return;

        const fetchedAt = get().fetchedAt;
        if (
          !options?.force &&
          fetchedAt !== null &&
          Date.now() - fetchedAt < MIN_FETCH_INTERVAL_MS
        ) {
          return;
        }

        set({ fetching: true });

        try {
          const manifest = await fetchFunctionAppsManifest();

          if (!manifest) {
            set({ fetchedAt: Date.now() });
            return;
          }

          set({
            sections: manifest.sections,
            fetchedAt: Date.now(),
          });
        } catch (e) {
          if (!isNetworkError(e)) {
            reportError(e, { module: "function-apps" });
          }
        } finally {
          set({ fetching: false });
        }
      },
    }),
    {
      name: "function-apps",
      storage: zustandStorage,
      partialize: (s) => ({
        sections: s.sections,
        fetchedAt: s.fetchedAt,
      }),
    },
  ),
);