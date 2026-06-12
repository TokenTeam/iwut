import { create } from "zustand";
import { persist } from "zustand/middleware";

import { isNetworkError } from "@/lib/network-error";
import { reportError } from "@/lib/report";
import { zustandStorage } from "@/lib/storage";
import {
  fetchAnnouncements,
  type Announcement,
} from "@/services/announcements";

const MIN_FETCH_INTERVAL_MS = 5 * 60 * 1000;

interface AnnouncementStore {
  announcements: Announcement[];
  dismissedIds: string[];
  fetching: boolean;
  fetchedAt: number | null;
  fetch: (options?: { force?: boolean }) => Promise<void>;
  dismiss: (id: string) => void;
}

export const useAnnouncementStore = create<AnnouncementStore>()(
  persist(
    (set, get) => ({
      announcements: [],
      dismissedIds: [],
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
          const list = await fetchAnnouncements();
          const validIds = new Set(list.map((a) => a.id));
          const dismissedIds = get().dismissedIds.filter((id) =>
            validIds.has(id),
          );
          set({ announcements: list, dismissedIds, fetchedAt: Date.now() });
        } catch (e) {
          if (!isNetworkError(e)) {
            reportError(e, { module: "announcements" });
          }
        } finally {
          set({ fetching: false });
        }
      },
      dismiss: (id: string) => {
        const cur = get().dismissedIds;
        if (cur.includes(id)) return;
        set({ dismissedIds: [...cur, id] });
      },
    }),
    {
      name: "announcements",
      storage: zustandStorage,
      partialize: (s) => ({
        announcements: s.announcements,
        dismissedIds: s.dismissedIds,
      }),
    },
  ),
);
