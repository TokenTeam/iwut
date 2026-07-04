import { MAX_WEEK } from "@/lib/course-weeks";
import { SECTION_TIMES } from "@/services/course-time";
import type { Course } from "@/store/course";

const LAB_API_BASE = "https://syjx.whut.edu.cn/api/minipro";
const REQUEST_TIMEOUT_MS = 15000;

// 学期时间一律按 UTC+8 计算
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

interface LabApiResponse<T> {
  status: string;
  code: number;
  data?: T;
  message?: string;
}

export interface LabCaptcha {
  key: string;
  /** base64 data URI */
  image: string;
}

export interface LabTerm {
  id: number;
  name: string;
  is_on: number;
}

export interface LabProject {
  id: number;
  project_name: string;
  name: string;
  class_name: string;
  experimental_field_name: string;
  experimental_field_location: string | null;
  teacher_name: string[];
  class_time: string;
  status: string;
  seat_number: number | null;
}

export class LabApiError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
    this.name = "LabApiError";
  }
}

async function labFetch<T>(
  path: string,
  init?: { method?: string; body?: unknown; token?: string },
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let resp: Response;
  try {
    resp = await fetch(`${LAB_API_BASE}${path}`, {
      method: init?.method ?? "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        ...(init?.token ? { Authorization: init.token } : {}),
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  let json: LabApiResponse<T>;
  try {
    json = await resp.json();
  } catch {
    throw new LabApiError(`HTTP ${resp.status}`);
  }
  if (json.status !== "success" || json.code !== 200) {
    throw new LabApiError(json.message || `HTTP ${resp.status}`, json.code);
  }
  return json.data as T;
}

export async function fetchLabCaptcha(): Promise<LabCaptcha> {
  const data = await labFetch<{ captcha_key: string; captcha_image: string }>(
    "/captcha",
    { method: "GET" },
  );
  return { key: data.captcha_key, image: data.captcha_image };
}

/** 登录实验教学系统，返回 Authorization 值 */
export async function loginLabSystem(params: {
  studentNumber: string;
  password: string;
  captcha: string;
  captchaKey: string;
}): Promise<string> {
  const data = await labFetch<{ access_token: string }>("/login", {
    body: {
      type: "student",
      student_number: params.studentNumber,
      password: params.password,
      captcha: params.captcha,
      captcha_key: params.captchaKey,
    },
  });
  const token = data.access_token;
  return token.startsWith("Bearer ") ? token : `Bearer ${token}`;
}

/** 返回当前启用学期 */
export async function fetchActiveLabTerm(
  token: string,
): Promise<LabTerm | null> {
  const terms = await labFetch<LabTerm[]>("/term_list", { body: {}, token });
  return terms.find((t) => t.is_on === 1) ?? null;
}

export async function fetchLabProjects(
  token: string,
  termId: number,
): Promise<LabProject[]> {
  const list = await labFetch<LabProject[]>(
    "/student/experimental_projects_list",
    { body: { term_id: termId, check_status: 0 }, token },
  );
  return Array.isArray(list) ? list : [];
}

// 实验系统的节次编号不含休息段：第1-5节对应 app 的 1-5，第6-10节对应
// 8-12，第11-13节对应 14-16；中课和晚课是独立标签，对应 6/7 和 13。
function labelToSection(label: string): number | null {
  let m = /^第(\d{1,2})节$/.exec(label);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 5) return n;
    if (n >= 6 && n <= 10) return n + 2;
    if (n >= 11 && n <= 13) return n + 3;
    return null;
  }
  m = /^中课(\d)?$/.exec(label);
  if (m) return m[1] === "2" ? 7 : 6;
  if (/^晚课\d?$/.test(label)) return 13;
  return null;
}

// 标签范围形如 "第1节-第6节"，一场实验连续占用首尾之间的所有节次
function sectionRangeFromLabels(
  startLabel: string,
  endLabel: string,
): [number, number] | null {
  const start = labelToSection(startLabel);
  const end = labelToSection(endLabel);
  if (start == null || end == null || end < start) return null;
  return [start, end];
}

// 标签无法识别时的兜底：取与时间段有重叠的首尾节次
function sectionRangeFromTimeRange(
  startMin: number,
  endMin: number,
): [number, number] | null {
  let start = Infinity;
  let end = -Infinity;
  for (const [key, [, , sMin, eMin]] of Object.entries(SECTION_TIMES)) {
    if (eMin > startMin && sMin < endMin) {
      const n = Number(key);
      if (n < start) start = n;
      if (n > end) end = n;
    }
  }
  return end >= start ? [start, end] : null;
}

function toMinutes(h: string, m: string): number {
  return Number(h) * 60 + Number(m);
}

function parseDateMs(date: string): number | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(date);
  if (!m) return null;
  return (
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - SHANGHAI_OFFSET_MS
  );
}

export interface LabClassTime {
  week: number;
  day: number;
  sectionStart: number;
  sectionEnd: number;
  startTime: string;
  endTime: string;
}

/**
 * 解析 "2026-03-05 第6节-第9节(14:00-17:30)" 形式的上课时间，
 * 依据学期起始日换算周次，无法解析时返回 null。
 * 一场实验视为连续时段，即使跨中课/晚课也显示为一个整块。
 */
export function parseLabClassTime(
  classTime: string,
  termStart: string,
): LabClassTime | null {
  const m =
    /^(\d{4}-\d{1,2}-\d{1,2})\s+(.*?)\((\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})\)/.exec(
      classTime.trim(),
    );
  if (!m) return null;

  const dateMs = parseDateMs(m[1]);
  const termStartMs = parseDateMs(termStart.split(" ")[0]);
  if (dateMs == null || termStartMs == null) return null;

  const week = Math.floor((dateMs - termStartMs) / WEEK_MS) + 1;
  if (week < 1 || week > MAX_WEEK) return null;

  const utcDay = new Date(dateMs + SHANGHAI_OFFSET_MS).getUTCDay();
  const day = utcDay === 0 ? 7 : utcDay;

  const labels = m[2].trim().split("-");
  const range =
    sectionRangeFromLabels(labels[0], labels[labels.length - 1]) ??
    sectionRangeFromTimeRange(toMinutes(m[3], m[4]), toMinutes(m[5], m[6]));
  if (!range) return null;

  return {
    week,
    day,
    sectionStart: range[0],
    sectionEnd: range[1],
    startTime: `${m[3]}:${m[4]}`,
    endTime: `${m[5]}:${m[6]}`,
  };
}

export interface LabProjectsParseResult {
  courses: Course[];
  /** 无法解析而跳过的记录数 */
  skipped: number;
}

/**
 * 把实验项目列表转换为课表课程。
 * 课程名使用所属实验课程名，具体实验项目名放入 note，
 * 避免同一门实验课的多个项目被拆成多门课。
 * 一场实验对应一个格子，不同场次之间保留课表的自然间隙。
 */
export function labProjectsToCourses(
  projects: LabProject[],
  termStart: string,
): LabProjectsParseResult {
  const courses: Course[] = [];
  let skipped = 0;

  for (const p of projects) {
    const name = (p.name || "").trim();
    const time = parseLabClassTime(p.class_time || "", termStart);
    if (!name || !time) {
      skipped++;
      continue;
    }
    courses.push({
      name,
      room: (
        p.experimental_field_location ||
        p.experimental_field_name ||
        ""
      ).trim(),
      teacher: Array.isArray(p.teacher_name)
        ? p.teacher_name.join("、")
        : String(p.teacher_name ?? ""),
      day: time.day,
      weekStart: time.week,
      weekEnd: time.week,
      sectionStart: time.sectionStart,
      sectionEnd: time.sectionEnd,
      startTime: time.startTime,
      endTime: time.endTime,
      note: (p.project_name || "").trim() || undefined,
      seat: typeof p.seat_number === "number" ? p.seat_number : undefined,
      source: "lab",
    });
  }

  return { courses, skipped };
}
