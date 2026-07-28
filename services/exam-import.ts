import type { Exam, NotArrangedExamCourse } from "@/store/exam";

export const EXAM_LOGIN_URL =
  "https://zhlgd.whut.edu.cn/tpass/login?service=https%3A%2F%2Fjwxt.whut.edu.cn%2Fjwapp%2Fsys%2Fwdkwapp%2F*default%2Findex.do%3FforceCas%3D1%23%2Fwdks";
export const EXAM_APP_PREFIX = "https://jwxt.whut.edu.cn/jwapp/sys/wdkwapp/";

export interface ExamRowsMessage {
  type: "examRows";
  term?: unknown;
  arranged?: unknown;
  notArranged?: unknown;
  showKeys?: unknown;
}

export interface ExamImportResult {
  term: string;
  exams: Exam[];
  notArranged: NotArrangedExamCourse[];
}

type RawExamRow = Record<string, unknown>;

function jsString(s: string): string {
  return JSON.stringify(s);
}

export function buildExamFetchScript(messages: {
  fetchUserFailed: string;
  importTimeout: string;
}): string {
  return `(async function() {
  var log = function(s){ window.ReactNativeWebView.postMessage(JSON.stringify({type:'debug', message:s})); };
  function post(payload) {
    window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  }
  function waitForReady(timeout) {
    var started = Date.now();
    return new Promise(function(resolve, reject) {
      (function tick() {
        var jq = window.jQuery || window.$;
        if (jq && jq.jwAjax && window.CACHE_DQXNXQ && CACHE_DQXNXQ.XNXQDM) {
          resolve(jq);
          return;
        }
        if (Date.now() - started > timeout) {
          reject(new Error(${jsString(messages.fetchUserFailed)}));
          return;
        }
        setTimeout(tick, 200);
      })();
    });
  }
  function queryExams($, term) {
    return new Promise(function(resolve, reject) {
      var done = false;
      $.jwAjax({
        url: '/api/wdks/queryMyExamArrangeMent.do',
        data: { XNXQDM: term },
        successMsg: '',
        success: function(resp) {
          done = true;
          resolve(resp || {});
        },
        error: function(err) {
          done = true;
          reject(err instanceof Error ? err : new Error('Request failed'));
        }
      });
      setTimeout(function() {
        if (!done) reject(new Error(${jsString(messages.importTimeout)}));
      }, 15000);
    });
  }
  try {
    var $ = await waitForReady(12000);
    var term = CACHE_DQXNXQ && CACHE_DQXNXQ.XNXQDM;
    log('exam term=' + term);
    if (!term) {
      post({type:'error', message:${jsString(messages.fetchUserFailed)}});
      return;
    }
    var resp = await queryExams($, term);
    post({
      type: 'examRows',
      term: term,
      arranged: Array.isArray(resp.arranged) ? resp.arranged : [],
      notArranged: Array.isArray(resp.notArranged) ? resp.notArranged : [],
      showKeys: Array.isArray(resp.showkeys) ? resp.showkeys : []
    });
  } catch(e) {
    post({
      type:'error',
      message: (e && e.message) ? String(e.message) : '',
      name: (e && e.name) ? String(e.name) : '',
      stack: (e && e.stack) ? String(e.stack).substring(0, 1000) : '',
      url: (typeof location !== 'undefined' && location.href) ? location.href : ''
    });
  }
})(); true;`;
}

export function isExamRowsMessage(msg: unknown): msg is ExamRowsMessage {
  return (
    typeof msg === "object" &&
    msg !== null &&
    "type" in msg &&
    msg.type === "examRows"
  );
}

function clean(value: unknown): string {
  const text = value == null ? "" : String(value).trim();
  if (!text || text === "null" || text === "-") return "";
  return text;
}

function normalizeExamClock(value: string): string {
  return value.replace(/^(\d):/, "0$1:");
}

function parseExamTime(
  value: unknown,
): Pick<Exam, "date" | "startTime" | "endTime" | "startAt" | "endAt"> {
  const text = clean(value);
  const match =
    /^(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/.exec(
      text,
    ) ??
    /^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/.exec(text);
  if (!match) {
    return { date: "", startTime: "", endTime: "", startAt: "", endAt: "" };
  }

  const year = match[1];
  const month = match[2].padStart(2, "0");
  const day = match[3].padStart(2, "0");
  const startTime = normalizeExamClock(match[4]);
  const endTime = normalizeExamClock(match[5]);
  const date = `${year}-${month}-${day}`;
  return {
    date,
    startTime,
    endTime,
    startAt: `${date}T${startTime}:00+08:00`,
    endAt: `${date}T${endTime}:00+08:00`,
  };
}

function titleId(row: RawExamRow, index: number): string {
  const parts = [clean(row.KCH), clean(row.KXH), clean(row.KCM), String(index)];
  return parts.filter(Boolean).join("-");
}

function normalizeExam(row: RawExamRow, index: number): Exam {
  const time = parseExamTime(row.KSSJMS);
  const rawStatus = clean(row.KSZT);
  return {
    id: titleId(row, index),
    courseName: clean(row.KCM),
    courseCode: clean(row.KCH),
    sequence: clean(row.KXH),
    rawStatus,
    ...time,
    place: clean(row.JASMC),
    seatNo: clean(row.ZWH),
    teacher: clean(row.SKJS),
    description: clean(row.KSSM),
  };
}

function normalizeNotArranged(
  row: RawExamRow,
  index: number,
): NotArrangedExamCourse {
  const courseCode = clean(row.KCH);
  const courseName = clean(row.KCM);
  return {
    id: [courseCode, courseName, String(index)].filter(Boolean).join("-"),
    courseName,
    courseCode,
    teacher: clean(row.SKJS),
  };
}

export function normalizeExamRowsMessage(
  msg: ExamRowsMessage,
): ExamImportResult {
  const arranged: RawExamRow[] = Array.isArray(msg.arranged)
    ? msg.arranged.filter(
        (row): row is RawExamRow => typeof row === "object" && row !== null,
      )
    : [];
  const notArrangedRows: RawExamRow[] = Array.isArray(msg.notArranged)
    ? msg.notArranged.filter(
        (row): row is RawExamRow => typeof row === "object" && row !== null,
      )
    : [];

  return {
    term: msg.term ? String(msg.term) : "",
    exams: arranged.map(normalizeExam).sort((a, b) => {
      const aTime = Date.parse(a.startAt);
      const bTime = Date.parse(b.startAt);
      if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
      if (Number.isNaN(aTime)) return 1;
      if (Number.isNaN(bTime)) return -1;
      return aTime - bTime;
    }),
    notArranged: notArrangedRows.map(normalizeNotArranged),
  };
}
