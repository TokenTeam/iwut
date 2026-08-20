import type { Grade } from "@/store/grade";

export const GRADE_LOGIN_URL =
  "https://zhlgd.whut.edu.cn/tpass/login?service=https%3A%2F%2Fjwxt.whut.edu.cn%2Fjwapp%2Fsys%2Fcjcx%2F*default%2Findex.do%3FforceCas%3D1";
export const GRADE_APP_PREFIX = "https://jwxt.whut.edu.cn/jwapp/sys/cjcx/";

const GRADE_QUERY_SETTINGS = [
  {
    name: "SFYX",
    caption: "是否有效",
    linkOpt: "AND",
    builderList: "cbl_m_List",
    builder: "m_value_equal",
    value: "1",
    value_display: "是",
  },
  {
    name: "SHOWMAXCJ",
    caption: "显示最高成绩",
    linkOpt: "AND",
    builderList: "cbl_String",
    builder: "equal",
    value: 0,
    value_display: "否",
  },
] as const;

export interface GradeRowsMessage {
  type: "gradeRows";
  rows?: unknown;
}

type RawGradeRow = Record<string, unknown>;

function jsString(value: string): string {
  return JSON.stringify(value);
}

export function buildGradeFetchScript(messages: {
  fetchFailed: string;
  queryTimeout: string;
}): string {
  return `(async function() {
  function post(payload) {
    window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  }
  async function queryPage(pageNumber) {
    var controller = new AbortController();
    var timer = setTimeout(function() { controller.abort(); }, 20000);
    var body = new URLSearchParams();
    body.append('querySetting', ${jsString(JSON.stringify(GRADE_QUERY_SETTINGS))});
    body.append('*json', '1');
    body.append('*order', '-XNXQDM,-KCH,-KXH');
    body.append('pageSize', '100');
    body.append('pageNumber', String(pageNumber));
    try {
      var response = await fetch('/jwapp/sys/cjcx/modules/cjcx/xscjcx.do', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: body.toString(),
        signal: controller.signal
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      var json = await response.json();
      var page = json && json.datas && json.datas.xscjcx;
      if (!page || !Array.isArray(page.rows)) {
        var reason = json && (json.msg || json.message);
        throw new Error(reason ? String(reason) : ${jsString(messages.fetchFailed)});
      }
      return page;
    } finally {
      clearTimeout(timer);
    }
  }
  function approvedFields(row) {
    return {
      KCM: row && row.KCM,
      XSKCH: row && row.XSKCH,
      KCXZDM_DISPLAY: row && row.KCXZDM_DISPLAY,
      ZCJ: row && row.ZCJ,
      XF: row && row.XF,
      CXCKDM_DISPLAY: row && row.CXCKDM_DISPLAY,
      XNXQDM_DISPLAY: row && row.XNXQDM_DISPLAY
    };
  }
  try {
    var first = await queryPage(1);
    var rows = first.rows.slice();
    var total = Number(first.totalSize) || rows.length;
    var pageSize = Number(first.pageSize) || 100;
    var pages = Math.max(1, Math.ceil(total / pageSize));
    for (var pageNumber = 2; pageNumber <= pages; pageNumber += 1) {
      var next = await queryPage(pageNumber);
      rows = rows.concat(next.rows);
    }
    post({ type: 'gradeRows', rows: rows.map(approvedFields) });
  } catch (error) {
    var isTimeout = error && error.name === 'AbortError';
    post({
      type: 'error',
      message: isTimeout
        ? ${jsString(messages.queryTimeout)}
        : ((error && error.message) ? String(error.message) : ${jsString(messages.fetchFailed)}),
      name: (error && error.name) ? String(error.name) : ''
    });
  }
})(); true;`;
}

export function isGradeRowsMessage(msg: unknown): msg is GradeRowsMessage {
  return (
    typeof msg === "object" &&
    msg !== null &&
    "type" in msg &&
    msg.type === "gradeRows"
  );
}

function clean(value: unknown): string {
  const text = value == null ? "" : String(value).trim();
  if (!text || text === "null") return "";
  return text;
}

function normalizeGrade(row: RawGradeRow): Grade {
  const term = clean(row.XNXQDM_DISPLAY);
  const courseName = clean(row.KCM);
  const courseCode = clean(row.XSKCH);
  const courseNature = clean(row.KCXZDM_DISPLAY);
  const totalScore = clean(row.ZCJ);
  const credits = clean(row.XF);
  const retakeLabel = clean(row.CXCKDM_DISPLAY);
  return {
    id: [term, courseCode || courseName, retakeLabel]
      .map(encodeURIComponent)
      .join("|"),
    term,
    courseName,
    courseCode,
    courseNature,
    totalScore,
    credits,
    retakeLabel,
  };
}

export function normalizeGradeRowsMessage(msg: GradeRowsMessage): Grade[] {
  const rows: RawGradeRow[] = Array.isArray(msg.rows)
    ? msg.rows.filter(
        (row): row is RawGradeRow => typeof row === "object" && row !== null,
      )
    : [];
  return rows
    .map(normalizeGrade)
    .filter((grade) => grade.term && (grade.courseCode || grade.courseName));
}
