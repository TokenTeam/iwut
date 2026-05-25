import { requireNativeModule } from "expo-modules-core";

export type WlanLoginStatus =
  | "connected"
  | "already-online"
  | "no-credentials"
  | "not-on-wifi"
  | "network-unavailable"
  | "authentication-failed";

export interface WlanLoginResult {
  status: WlanLoginStatus;
  message?: string;
}

interface WlanNativeModule {
  saveCredentials(username: string, password: string): Promise<void>;
  clearCredentials(): Promise<void>;
  hasCredentials(): Promise<boolean>;
  getSavedUsername(): Promise<string | null>;
  login(): Promise<WlanLoginResult>;
  requestPinnedShortcut(): Promise<boolean>;
}

const NativeModule = requireNativeModule<WlanNativeModule>("Wlan");

export const saveCredentials = NativeModule.saveCredentials;
export const clearCredentials = NativeModule.clearCredentials;
export const hasCredentials = NativeModule.hasCredentials;
export const getSavedUsername = NativeModule.getSavedUsername;
export const login = NativeModule.login;
export const requestPinnedShortcut = NativeModule.requestPinnedShortcut;
