import * as SecureStore from "expo-secure-store";
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
        await SecureStore.deleteItemAsync("wlan_password");
        set({ username, hasSaved: true });
      },

      clear: async () => {
        await clearCredentials();
        await SecureStore.deleteItemAsync("wlan_password");
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
        if (!hasSaved || !username) return;

        const legacyPassword = await SecureStore.getItemAsync("wlan_password");
        if (!legacyPassword) return;
        await saveCredentials(username, legacyPassword);
        await SecureStore.deleteItemAsync("wlan_password");
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
