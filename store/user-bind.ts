import * as SecureStore from "expo-secure-store";
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
  bind: (studentId: string, studentName: string, password: string, cardId: string, college: string, eduLevel: string) => void;
  unbind: () => void;
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

      bind: (studentId, studentName, password, cardId, college, eduLevel) => {
        SecureStore.setItemAsync("zhlgd_password", password);
        set({ isBound: true, studentId, studentName, cardId, college, eduLevel });
      },

      unbind: () => {
        SecureStore.deleteItemAsync("zhlgd_password");
        set({ isBound: false, studentId: "", studentName: "", cardId: "", college: "", eduLevel: "" });
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
        eduLevel: state.eduLevel
      }),
    },
  ),
);
