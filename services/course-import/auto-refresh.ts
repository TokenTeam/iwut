import { getShanghaiDateIndex } from "@/lib/date";
import type { Course, ImportType } from "@/store/course";

export type BaseImportType = Exclude<ImportType, "lab">;

export interface CourseImportOrigin {
  type: BaseImportType;
  studentId: string;
}

export function canAutoRefreshCourses(params: {
  enabled: boolean;
  isBound: boolean;
  studentId: string;
  origin: CourseImportOrigin | null;
  lastSuccessAt: number | null;
  now: number;
}): boolean {
  return (
    params.enabled &&
    params.isBound &&
    !!params.studentId &&
    params.origin?.studentId === params.studentId &&
    (params.origin.type === "bachelor" || params.origin.type === "master") &&
    (params.lastSuccessAt === null ||
      getShanghaiDateIndex(params.lastSuccessAt) !==
        getShanghaiDateIndex(params.now))
  );
}

export function canApplyAutoRefresh(params: {
  previousCourses: Course[];
  currentCourses: Course[];
  previousTermStart: string;
  currentTermStart: string;
  incomingTermStart: string;
  incomingCourses: Course[];
}): boolean {
  return (
    params.previousCourses === params.currentCourses &&
    params.previousTermStart === params.currentTermStart &&
    !!params.previousTermStart &&
    params.incomingTermStart === params.previousTermStart &&
    params.incomingCourses.length > 0
  );
}
