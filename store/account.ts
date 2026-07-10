import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { zustandStorage } from "@/lib/storage";
import {
  AuthCenterError,
  type AuthCenterProfile,
  type AuthCenterTokens,
  getAuthCenterProfile,
  loginToAuthCenter,
  refreshAuthCenterTokens,
  registerAuthCenterAccount,
} from "@/services/auth-center";

const ACCESS_TOKEN_KEY = "auth_center_access_token";
const REFRESH_TOKEN_KEY = "auth_center_refresh_token";

export type AccountMode = "pending" | "guest" | "authenticated";

export class AutoLoginFailedError extends Error {
  constructor(readonly original: unknown) {
    super("registered but auto sign-in failed");
    this.name = "AutoLoginFailedError";
  }
}

let tokenRefreshPromise: Promise<AuthCenterTokens> | null = null;

async function refreshStoredTokens(): Promise<AuthCenterTokens> {
  if (!tokenRefreshPromise) {
    tokenRefreshPromise = (async () => {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (!refreshToken) {
        throw new AuthCenterError(
          "session expired",
          "account.loginFailed",
          401,
        );
      }
      const tokens = await refreshAuthCenterTokens(refreshToken);
      await Promise.all([
        SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
        SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
      ]);
      return tokens;
    })().finally(() => {
      tokenRefreshPromise = null;
    });
  }
  return tokenRefreshPromise;
}

interface AccountStore {
  mode: AccountMode;
  email: string;
  profile: AuthCenterProfile | null;
  profileLoading: boolean;
  profileLoadFailed: boolean;
  continueAsGuest: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    verifyCode: string,
    password: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  refreshProfile: () => Promise<void>;
}

export const useAccountStore = create<AccountStore>()(
  persist(
    (set, get) => ({
      mode: "pending",
      email: "",
      profile: null,
      profileLoading: false,
      profileLoadFailed: false,

      continueAsGuest: () =>
        set({
          mode: "guest",
          email: "",
          profile: null,
          profileLoadFailed: false,
        }),

      login: async (email, password) => {
        const normalizedEmail = email.trim().toLowerCase();
        const tokens = await loginToAuthCenter(normalizedEmail, password);

        await Promise.all([
          SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
          SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
        ]);
        set({
          mode: "authenticated",
          email: normalizedEmail,
          profile: null,
          profileLoadFailed: false,
        });
        void get().refreshProfile();
      },

      register: async (email, verifyCode, password) => {
        const normalizedEmail = email.trim().toLowerCase();
        await registerAuthCenterAccount(
          normalizedEmail,
          verifyCode.trim(),
          password,
        );
        try {
          await get().login(normalizedEmail, password);
        } catch (cause) {
          throw new AutoLoginFailedError(cause);
        }
      },

      logout: async () => {
        set({
          mode: "guest",
          email: "",
          profile: null,
          profileLoading: false,
          profileLoadFailed: false,
        });
        await Promise.all([
          SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
          SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
        ]);
      },

      getAccessToken: () => SecureStore.getItemAsync(ACCESS_TOKEN_KEY),

      refreshProfile: async () => {
        if (get().mode !== "authenticated" || get().profileLoading) return;
        const accountEmail = get().email;
        set({ profileLoading: true, profileLoadFailed: false });

        try {
          let accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
          if (!accessToken) {
            throw new AuthCenterError(
              "session expired",
              "account.loginFailed",
              401,
            );
          }

          let profile: AuthCenterProfile;
          try {
            profile = await getAuthCenterProfile(accessToken);
          } catch (error) {
            if (!(error instanceof AuthCenterError) || error.code !== 401) {
              throw error;
            }
            const tokens = await refreshStoredTokens();
            accessToken = tokens.accessToken;
            profile = await getAuthCenterProfile(accessToken);
          }

          if (get().mode === "authenticated" && get().email === accountEmail) {
            set({ email: profile.email, profile, profileLoadFailed: false });
          }
        } catch {
          if (get().mode === "authenticated" && get().email === accountEmail) {
            set({ profileLoadFailed: true });
          }
        } finally {
          if (get().mode === "authenticated" && get().email === accountEmail) {
            set({ profileLoading: false });
          }
        }
      },
    }),
    {
      name: "account",
      storage: zustandStorage,
      partialize: (state) => ({ mode: state.mode, email: state.email }),
    },
  ),
);
