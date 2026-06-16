import { create } from "zustand";
import { persist } from "zustand/middleware";

import { zustandStorage } from "@/lib/storage";

export type ExamStatus = "upcoming" | "ongoing" | "finished" | "unknown";

export interface Exam {
  id: string;
  courseName: string;
  courseCode: string;
  sequence: string;
  status: ExamStatus;
  rawStatus: string;
  date: string;
  startTime: string;
  endTime: string;
  startAt: string;
  endAt: string;
  place: string;
  seatNo: string;
  teacher: string;
  description: string;
}

export interface NotArrangedExamCourse {
  id: string;
  courseName: string;
  courseCode: string;
  teacher: string;
}

interface ExamStore {
  term: string;
  exams: Exam[];
  notArranged: NotArrangedExamCourse[];
  importedAt: string;
  setExamData: (data: {
    term: string;
    exams: Exam[];
    notArranged: NotArrangedExamCourse[];
  }) => void;
  clearExamData: () => void;
}

export const useExamStore = create<ExamStore>()(
  persist(
    (set) => ({
      term: "",
      exams: [],
      notArranged: [],
      importedAt: "",
      setExamData: ({ term, exams, notArranged }) =>
        set({
          term,
          exams,
          notArranged,
          importedAt: new Date().toISOString(),
        }),
      clearExamData: () =>
        set({ term: "", exams: [], notArranged: [], importedAt: "" }),
    }),
    {
      name: "exam",
      storage: zustandStorage,
    },
  ),
);
