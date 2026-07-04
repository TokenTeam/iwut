import { create } from "zustand";
import { persist } from "zustand/middleware";

import { dedupeCourses } from "@/lib/course-dedupe";
import { zustandStorage } from "@/lib/storage";

export type ImportType = "bachelor" | "master" | "lab";

export interface Course {
  name: string; // 课程名
  room: string; // 教室
  teacher: string; // 教师
  weekStart: number; // 开始周数
  weekEnd: number; // 结束周数
  day: number; // 星期几
  sectionStart: number; // 开始节数
  sectionEnd: number; // 结束节数
  note?: string; // 附加信息
  seat?: number; // 座位号
  startTime?: string; // 真实开始时间 "HH:mm"，节次仅用于排版定位
  endTime?: string; // 真实结束时间 "HH:mm"
  source?: "imported" | "manual" | "lab";
}

interface CourseStore {
  courses: Course[];
  termStart: string;
  setImportedCourses: (courses: Course[]) => void;
  setLabCourses: (courses: Course[]) => void;
  setCourses: (courses: Course[]) => void;
  setTermStart: (termStart: string) => void;
  addCourse: (course: Course) => void;
  removeCoursesByName: (name: string) => void;
}

export const useCourseStore = create<CourseStore>()(
  persist(
    (set, get) => ({
      courses: [],
      termStart: "",
      setImportedCourses: (imported: Course[]) => {
        // 只替换普通导入课程，保留手动添加与实验课
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
        // 实验课作为独立来源，重新导入只覆盖旧的实验课
        const kept = get().courses.filter((c) => c.source !== "lab");
        const tagged = imported.map((c) => ({
          ...c,
          source: "lab" as const,
        }));
        set({ courses: dedupeCourses([...kept, ...tagged]) });
      },
      setCourses: (courses: Course[]) => set({ courses }),
      setTermStart: (termStart: string) => set({ termStart }),
      addCourse: (course: Course) =>
        set({ courses: [...get().courses, course] }),
      removeCoursesByName: (name: string) =>
        set({ courses: get().courses.filter((c) => c.name !== name) }),
    }),
    {
      name: "course",
      storage: zustandStorage,
    },
  ),
);
