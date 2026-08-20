import { create } from "zustand";
import { persist } from "zustand/middleware";

import { zustandStorage } from "@/lib/storage";

export interface Grade {
  id: string;
  term: string;
  courseName: string;
  courseCode: string;
  courseNature: string;
  totalScore: string;
  credits: string;
  retakeLabel: string;
}

function compareGrades(a: Grade, b: Grade): number {
  return (
    b.term.localeCompare(a.term) ||
    a.courseCode.localeCompare(b.courseCode) ||
    a.courseName.localeCompare(b.courseName)
  );
}

function prepareGrades(grades: Grade[]): Grade[] {
  const byId = new Map(grades.map((grade) => [grade.id, grade]));
  return Array.from(byId.values()).sort(compareGrades);
}

interface GradeStore {
  grades: Grade[];
  syncedAt: string;
  replaceGrades: (grades: Grade[]) => void;
  clearGrades: () => void;
}

export const useGradeStore = create<GradeStore>()(
  persist(
    (set) => ({
      grades: [],
      syncedAt: "",
      replaceGrades: (grades) =>
        set({
          grades: prepareGrades(grades),
          syncedAt: new Date().toISOString(),
        }),
      clearGrades: () => set({ grades: [], syncedAt: "" }),
    }),
    {
      name: "grade",
      storage: zustandStorage,
    },
  ),
);
