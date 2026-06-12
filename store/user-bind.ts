import * as SecureStore from "expo-secure-store";
import CookieManager from "@preeternal/react-native-cookie-manager";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { zustandStorage } from "@/lib/storage";

interface UserBindStore {
  isBound: boolean;
  studentId: string;
  studentName: string;
  cardId: string;
  college: string;
  eduLevel: string;
  bind: (
    studentId: string,
    studentName: string,
    password: string,
    cardId: string,
    college: string,
    eduLevel: string,
  ) => Promise<void>;
  unbind: () => Promise<void>;
  getCredentials: () => Promise<{
    username: string;
    password: string;
  } | null>;
}

export const useUserBindStore = create<UserBindStore>()(
  persist(
    (set, get) => ({
      isBound: false,
      studentId: "",
      studentName: "",
      cardId: "",
      college: "",
      eduLevel: "",

      bind: async (
        studentId,
        studentName,
        password,
        cardId,
        college,
        eduLevel,
      ) => {
        // 先确保密码写入成功，再更新绑定状态，避免读到 isBound 但无凭据
        await SecureStore.setItemAsync("zhlgd_password", password);
        set({
          isBound: true,
          studentId,
          studentName,
          cardId,
          college,
          eduLevel,
        });
      },

      unbind: async () => {
        await SecureStore.deleteItemAsync("zhlgd_password");
        await CookieManager.clearAll(true);
        set({
          isBound: false,
          studentId: "",
          studentName: "",
          cardId: "",
          college: "",
          eduLevel: "",
        });
      },

      getCredentials: async () => {
        const { isBound, studentId } = get();
        if (!isBound || !studentId) return null;
        const password = await SecureStore.getItemAsync("zhlgd_password");
        if (!password) return null;
        return { username: studentId, password };
      },
    }),
    {
      name: "user-bind",
      storage: zustandStorage,
      partialize: (state) => ({
        isBound: state.isBound,
        studentId: state.studentId,
        studentName: state.studentName,
        cardId: state.cardId,
        college: state.college,
        eduLevel: state.eduLevel,
      }),
    },
  ),
);
