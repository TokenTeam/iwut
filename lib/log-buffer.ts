import { IS_DEV } from "@/constants/is-dev";

export type LogLevelName = "debug" | "info" | "warn" | "error";

export class LogEntry {
  private formattedTime: string | undefined;
  private formattedPreview: string | undefined;

  constructor(
    readonly id: number,
    private readonly timestamp: number,
    readonly level: LogLevelName,
    readonly module: string,
    readonly message: string,
  ) {}

  get time() {
    return (this.formattedTime ??= formatTime(this.timestamp));
  }

  get preview() {
    return (this.formattedPreview ??= this.message
      .slice(0, 256)
      .replace(/\s+/g, " "));
  }
}

const CAPACITY = 500;
const EMPTY: LogEntry[] = [];
const entries = new Array<LogEntry | undefined>(CAPACITY).fill(undefined);
const listeners = new Set<() => void>();
let nextId = 0;
let cursor = 0;
let size = 0;
let dirty = false;
let snapshot: LogEntry[] = EMPTY;
let timer: ReturnType<typeof setTimeout> | undefined;
let cachedSecond = -1;
let cachedTimePrefix = "";

function pad(value: number, length = 2) {
  return String(value).padStart(length, "0");
}

function formatTime(timestamp: number) {
  const second = Math.floor(timestamp / 1000);
  // 同一秒内复用日期和时分秒，只补上毫秒
  if (second !== cachedSecond) {
    const date = new Date(timestamp);
    cachedTimePrefix = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    cachedSecond = second;
  }
  return `${cachedTimePrefix}.${pad(timestamp - second * 1000, 3)}`;
}

function scheduleNotify() {
  if (timer !== undefined || listeners.size === 0) return;
  timer = setTimeout(() => {
    timer = undefined;
    for (const listener of listeners) listener();
  }, 250);
}

export function appendLog(
  level: LogLevelName,
  module: string | null | undefined,
  message: string,
) {
  if (!IS_DEV) return;
  // 环形缓存直接覆盖旧日志
  entries[cursor] = new LogEntry(
    ++nextId,
    Date.now(),
    level,
    module || "App",
    message,
  );
  if (++cursor === CAPACITY) cursor = 0;
  if (size < CAPACITY) size++;
  dirty = true;
  if (listeners.size > 0) {
    scheduleNotify();
  } else {
    // 无订阅时不保留旧快照对已覆盖日志的引用
    snapshot = EMPTY;
  }
}

export function getLogs(): LogEntry[] {
  if (dirty) {
    const next = new Array<LogEntry>(size);
    let index = cursor;
    for (let offset = 0; offset < size; offset++) {
      if (--index < 0) index = CAPACITY - 1;
      next[offset] = entries[index]!;
    }
    snapshot = next;
    dirty = false;
  }
  return snapshot;
}

export function subscribeLogs(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      snapshot = EMPTY;
      dirty = size > 0;
    }
  };
}

export function clearLogs() {
  entries.fill(undefined);
  cursor = 0;
  size = 0;
  snapshot = EMPTY;
  dirty = false;
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
  for (const listener of listeners) listener();
}
