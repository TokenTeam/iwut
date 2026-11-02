import { create } from "zustand";
import { persist } from "zustand/middleware";

import { zustandStorage } from "@/lib/storage";
import {
  clearCredentials,
  getSavedUsername,
  hasCredentials,
  saveCredentials,
} from "@/modules/wlan";

interface WlanStore {
  username: string;
  hasSaved: boolean;
  save: (username: string, password: string) => Promise<void>;
  clear: () => Promise<void>;
  syncCredentials: () => Promise<void>;
}

export const useWlanStore = create<WlanStore>()(
  persist(
    (set, get) => ({
      username: "",
      hasSaved: false,

      save: async (username, password) => {
        await saveCredentials(username, password);
        set({ username, hasSaved: true });
      },

      clear: async () => {
        await clearCredentials();
        set({ username: "", hasSaved: false });
      },

      syncCredentials: async () => {
        const { hasSaved, username } = get();
        if (await hasCredentials()) {
          const savedUsername = await getSavedUsername();
          if (savedUsername && (!hasSaved || username !== savedUsername)) {
            set({ username: savedUsername, hasSaved: true });
          }
          return;
        }
        if (hasSaved || username) set({ username: "", hasSaved: false });
      },
    }),
    {
      name: "wlan",
      storage: zustandStorage,
      partialize: (state) => ({
        username: state.username,
        hasSaved: state.hasSaved,
      }),
    },
  ),
);
