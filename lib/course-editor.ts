import { weeksToRanges } from "@/lib/course-weeks";
import type { Course } from "@/store/course";

export interface CourseTimeSlot {
  id: string;
  day: number;
  sectionStart: number;
  sectionEnd: number;
  timeMode: "sections" | "time";
  startTime?: string;
  endTime?: string;
  room: string;
  note?: string;
  seat?: number;
  weeks: Set<number>;
}

let nextSlotId = 0;

export function createEmptySlot(): CourseTimeSlot {
  return {
    id: `slot-${++nextSlotId}`,
    day: 1,
    sectionStart: 1,
    sectionEnd: 2,
    timeMode: "sections",
    room: "",
    weeks: new Set(),
  };
}

export function recordsToSlots(records: Course[]): CourseTimeSlot[] {
  const slots = new Map<string, CourseTimeSlot>();
  for (const record of records) {
    const fields = {
      day: record.day,
      sectionStart: record.sectionStart,
      sectionEnd: record.sectionEnd,
      timeMode: record.timeMode ?? "sections",
      startTime: record.startTime,
      endTime: record.endTime,
      room: record.room ?? "",
      note: record.note,
      seat: record.seat,
    };
    const key = JSON.stringify(fields);
    let slot = slots.get(key);
    if (!slot) {
      slot = { ...createEmptySlot(), ...fields };
      slots.set(key, slot);
    }
    for (let week = record.weekStart; week <= record.weekEnd; week++) {
      slot.weeks.add(week);
    }
  }
  return slots.size > 0 ? [...slots.values()] : [createEmptySlot()];
}

export function slotsToRecords(
  slots: CourseTimeSlot[],
  name: string,
  teacher: string,
): Course[] {
  return slots.flatMap(({ id: _id, weeks, ...fields }) =>
    weeksToRanges(weeks).map(([weekStart, weekEnd]) => ({
      ...fields,
      name: name.trim(),
      teacher: teacher.trim(),
      room: fields.room.trim(),
      weekStart,
      weekEnd,
      source: "manual" as const,
    })),
  );
}
