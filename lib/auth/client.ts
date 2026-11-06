import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

import { AUTH_URL } from "@/constants/api";

export const authClient = createAuthClient({
  baseURL: __DEV__ ? process.env.EXPO_PUBLIC_AUTH_URL : AUTH_URL,
  plugins: [
    expoClient({
      scheme: "iwut",
      storagePrefix: "iwut",
      storage: SecureStore,
    }),
  ],
});
