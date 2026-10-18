import { MAX_SECTION, MAX_WEEK } from "@/lib/course-weeks";
import { isValidCourseTimeRange } from "@/services/course-time";
import { type Course, useCourseStore } from "@/store/course";

import type { ScanEnvelope } from "../protocol";
import type { ScanActionHandler, ScanExecuteResult } from "../types";

export const COURSE_SINGLE_SCAN_TYPE = "course.single";

export interface SharedCourseSlot {
  room: string;
  day: number;
  sectionStart: number;
  sectionEnd: number;
  weekStart: number;
  weekEnd: number;
  startTime?: string;
  endTime?: string;
  timeMode?: Course["timeMode"];
  note?: string;
  seat?: number;
}

export interface SharedCourse {
  name: string;
  teacher: string;
  slots: SharedCourseSlot[];
}

export function buildCourseSingleScanEnvelope(
  records: Course[],
): ScanEnvelope<SharedCourse> {
  const [first] = records;
  return {
    app: "iwut",
    version: 1,
    action: "import",
    type: COURSE_SINGLE_SCAN_TYPE,
    payload: {
      name: first?.name ?? "",
      teacher: first?.teacher ?? "",
      slots: records.map((r) => ({
        room: r.room,
        day: r.day,
        sectionStart: r.sectionStart,
        sectionEnd: r.sectionEnd,
        weekStart: r.weekStart,
        weekEnd: r.weekEnd,
        startTime: r.startTime,
        endTime: r.endTime,
        timeMode: r.timeMode,
        note: r.note,
        seat: r.seat,
      })),
    },
  };
}

function isValidSlot(value: unknown): value is SharedCourseSlot {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.room === "string" &&
    isInt(s.day, 1, 7) &&
    isInt(s.sectionStart, 1, MAX_SECTION) &&
    isInt(s.sectionEnd, s.sectionStart as number, MAX_SECTION) &&
    isInt(s.weekStart, 1, MAX_WEEK) &&
    isInt(s.weekEnd, s.weekStart as number, MAX_WEEK) &&
    (s.timeMode === undefined ||
      s.timeMode === "sections" ||
      s.timeMode === "time") &&
    (s.note === undefined || typeof s.note === "string") &&
    (s.seat === undefined ||
      (typeof s.seat === "number" && Number.isInteger(s.seat))) &&
    (s.startTime === undefined &&
    s.endTime === undefined &&
    s.timeMode !== "time"
      ? true
      : typeof s.startTime === "string" &&
        typeof s.endTime === "string" &&
        isValidCourseTimeRange(s.startTime, s.endTime))
  );
}

function isInt(value: unknown, min: number, max: number): boolean {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  );
}

function getCoursePayload(envelope: ScanEnvelope): SharedCourse | null {
  const data = envelope.payload;
  if (typeof data !== "object" || data === null) return null;
  const obj = data as Record<string, unknown>;
  if (typeof obj.name !== "string" || obj.name.trim().length === 0) return null;
  if (typeof obj.teacher !== "string") return null;
  if (!Array.isArray(obj.slots) || obj.slots.length === 0) return null;
  if (!obj.slots.every(isValidSlot)) return null;
  return obj as unknown as SharedCourse;
}

export const courseSingleScanAction: ScanActionHandler = {
  id: COURSE_SINGLE_SCAN_TYPE,
  canHandle: (envelope) =>
    envelope.action === "import" && envelope.type === COURSE_SINGLE_SCAN_TYPE,
  getPreview: (envelope, context) => {
    const payload = getCoursePayload(envelope);
    if (!payload) return null;

    const conflict = useCourseStore
      .getState()
      .courses.some((c) => c.name === payload.name);

    return {
      title: context.t("scan.coursePreviewTitle"),
      description: conflict
        ? context.t("scan.courseOverwriteDesc", { name: payload.name })
        : context.t("scan.coursePreviewDesc", { name: payload.name }),
      confirmText: conflict
        ? context.t("scan.importCourseOverwrite")
        : context.t("scan.importCourse"),
      details: [
        {
          label: context.t("scan.detailName"),
          value: payload.name,
        },
        {
          label: context.t("scan.detailTeacher"),
          value: payload.teacher || "—",
        },
        {
          label: context.t("scan.detailSlots"),
          value: context.t("scan.slotsCount", { n: payload.slots.length }),
        },
      ],
    };
  },
  execute: async (envelope, context): Promise<ScanExecuteResult> => {
    const payload = getCoursePayload(envelope);
    if (!payload) throw new Error("Invalid course payload");

    const store = useCourseStore.getState();
    store.saveCourse(
      payload.slots.map((slot) => ({
        name: payload.name,
        teacher: payload.teacher,
        room: slot.room,
        day: slot.day,
        sectionStart: slot.sectionStart,
        sectionEnd: slot.sectionEnd,
        weekStart: slot.weekStart,
        weekEnd: slot.weekEnd,
        startTime: slot.startTime,
        endTime: slot.endTime,
        timeMode: slot.timeMode,
        note: slot.note,
        seat: slot.seat,
        source: "manual" as const,
      })),
      payload.name,
    );

    return {
      title: context.t("scan.courseImported", { name: payload.name }),
    };
  },
};
