import { create } from "zustand";
import { persist } from "zustand/middleware";

import { dedupeCourses } from "@/lib/course-dedupe";
import { zustandStorage } from "@/lib/storage";
import type { CourseImportOrigin } from "@/services/course-import/auto-refresh";

export type ImportType = "bachelor" | "master" | "lab";

export interface Course {
  name: string;
  room: string;
  teacher: string;
  weekStart: number;
  weekEnd: number;
  day: number; // 1 为周一，7 为周日
  sectionStart: number;
  sectionEnd: number;
  note?: string;
  seat?: number;
  // 自定义时间支持 H:mm 和 HH:mm 格式，优先于节次时间，节次仍用于课表布局
  startTime?: string;
  endTime?: string;
  timeMode?: "sections" | "time"; // 时间编辑模式，默认按节数调整
  source?: "imported" | "manual" | "lab";
}

interface CourseStore {
  courses: Course[];
  termStart: string;
  importOrigin: CourseImportOrigin | null;
  lastAutoRefreshSuccessAt: number | null;
  manualImportActive: boolean;
  applyImportedCourses: (
    courses: Course[],
    termStart: string,
    origin: CourseImportOrigin,
  ) => void;
  clearImportOrigin: () => void;
  setImportedCourses: (courses: Course[]) => void;
  setLabCourses: (courses: Course[]) => void;
  setCourses: (courses: Course[]) => void;
  setTermStart: (termStart: string) => void;
  addCourse: (course: Course) => void;
  saveCourse: (records: Course[], previousName?: string) => void;
  removeCoursesByName: (name: string) => void;
}

export const useCourseStore = create<CourseStore>()(
  persist(
    (set, get) => ({
      courses: [],
      termStart: "",
      importOrigin: null,
      lastAutoRefreshSuccessAt: null,
      manualImportActive: false,
      applyImportedCourses: (imported, termStart, origin) => {
        const kept = get().courses.filter(
          (c) => c.source === "manual" || c.source === "lab",
        );
        const tagged = imported.map((c) => ({
          ...c,
          source: "imported" as const,
        }));
        set({
          courses: dedupeCourses([...tagged, ...kept]),
          termStart: termStart || get().termStart,
          importOrigin: origin,
        });
      },
      clearImportOrigin: () =>
        set({
          importOrigin: null,
          lastAutoRefreshSuccessAt: null,
        }),
      setImportedCourses: (imported: Course[]) => {
        // 导入普通课程时，保留手动添加的课程和实验课
        const kept = get().courses.filter(
          (c) => c.source === "manual" || c.source === "lab",
        );
        const tagged = imported.map((c) => ({
          ...c,
          source: "imported" as const,
        }));
        set({ courses: dedupeCourses([...tagged, ...kept]) });
      },
      setLabCourses: (imported: Course[]) => {
        // 导入实验课时，只替换已有的实验课
        const kept = get().courses.filter((c) => c.source !== "lab");
        const tagged = imported.map((c) => ({
          ...c,
          source: "lab" as const,
        }));
        set({ courses: dedupeCourses([...kept, ...tagged]) });
      },
      setCourses: (courses: Course[]) =>
        set({
          courses,
          ...(courses.length === 0
            ? {
                importOrigin: null,
                lastAutoRefreshSuccessAt: null,
              }
            : {}),
        }),
      setTermStart: (termStart: string) => set({ termStart }),
      addCourse: (course: Course) =>
        set({ courses: [...get().courses, course] }),
      saveCourse: (records, previousName) =>
        set((state) => ({
          courses: [
            ...state.courses.filter((course) => course.name !== previousName),
            ...records,
          ],
        })),
      removeCoursesByName: (name: string) =>
        set({ courses: get().courses.filter((c) => c.name !== name) }),
    }),
    {
      name: "course",
      storage: zustandStorage,
      partialize: (state) => ({
        courses: state.courses,
        termStart: state.termStart,
        importOrigin: state.importOrigin,
        lastAutoRefreshSuccessAt: state.lastAutoRefreshSuccessAt,
      }),
    },
  ),
);
