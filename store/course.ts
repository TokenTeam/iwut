import { create } from "zustand";
import { persist } from "zustand/middleware";

import { zustandStorage } from "@/lib/storage";

export type ImportType = "bachelor" | "master";

export interface Course {
  name: string; // 课程名
  room: string; // 教室
  teacher: string; // 教师
  weekStart: number; // 开始周数
  weekEnd: number; // 结束周数
  day: number; // 星期几
  sectionStart: number; // 开始节数
  sectionEnd: number; // 结束节数
  source?: "imported" | "manual";
}

function coursesMatch(a: Course, b: Course): boolean {
  return (
    a.name === b.name &&
    a.day === b.day &&
    a.sectionStart === b.sectionStart &&
    a.sectionEnd === b.sectionEnd &&
    a.weekStart === b.weekStart &&
    a.weekEnd === b.weekEnd
  );
}

interface CourseStore {
  courses: Course[];
  termStart: string;
  lastImportType: ImportType | null;
  setImportedCourses: (courses: Course[]) => void;
  setCourses: (courses: Course[]) => void;
  setTermStart: (termStart: string) => void;
  setLastImportType: (type: ImportType) => void;
  addCourse: (course: Course) => void;
  removeCourse: (course: Course) => void;
  removeCoursesByName: (name: string) => void;
}

export const useCourseStore = create<CourseStore>()(
  persist(
    (set, get) => ({
      courses: [],
      termStart: "",
      lastImportType: null,
      setImportedCourses: (imported: Course[]) => {
        const manual = get().courses.filter((c) => c.source === "manual");
        const tagged = imported.map((c) => ({
          ...c,
          source: "imported" as const,
        }));
        set({ courses: [...tagged, ...manual] });
      },
      setCourses: (courses: Course[]) => set({ courses }),
      setTermStart: (termStart: string) => set({ termStart }),
      setLastImportType: (type: ImportType) => set({ lastImportType: type }),
      addCourse: (course: Course) =>
        set({ courses: [...get().courses, course] }),
      removeCourse: (target: Course) =>
        set({
          courses: get().courses.filter((c) => !coursesMatch(c, target)),
        }),
      removeCoursesByName: (name: string) =>
        set({ courses: get().courses.filter((c) => c.name !== name) }),
    }),
    {
      name: "course",
      storage: zustandStorage,
    },
  ),
);
