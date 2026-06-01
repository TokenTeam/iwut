import {
  parseMasterCourseRows,
  type MasterTimeTableRow,
} from "@/services/course-import/master-parser";
import type { Course } from "@/store/course";

export const MASTER_LOGIN_URL =
  "https://zhlgd.whut.edu.cn/tpass/login?service=https%3a%2f%2fyjsgl.whut.edu.cn%2fcas%2fCasLogin.ashx%3fredirectUrl%3d";
export const MASTER_MAIN_PREFIX = "https://yjsgl.whut.edu.cn/MainFrame.htm";

const MASTER_TIME_TABLE_API =
  "TimeTableNewService/GetTimeTableByStudent/{Year}/{Term}/{XH}?IsConti={IsConti}";

export interface MasterRowsMessage {
  type: "masterRows";
  data?: unknown;
  term?: unknown;
  termStart?: unknown;
}

export interface MasterRowsImportResult {
  courses: Course[];
  term: string;
  termStart: string;
}

function jsString(s: string): string {
  return JSON.stringify(s);
}

export function buildMasterFetchScript(messages: {
  fetchUserFailed: string;
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
        if (window.Global && Global.UserInfo && Global.UniversityInfo && window.jQueryHelper && jQueryHelper.Ajax) {
          resolve();
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
  function formatDate(value) {
    var match = String(value || '').match(/\\/Date\\((\\d+)/);
    if (!match) return '';
    var date = new Date(parseInt(match[1], 10));
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return date.getFullYear() + '-' + month + '-' + day;
  }
  function fetchRows(xh, year, term) {
    return new Promise(function(resolve, reject) {
      var done = false;
      jQueryHelper.Ajax.Get(${jsString(MASTER_TIME_TABLE_API)}, {
        XH: xh,
        Year: year,
        Term: term,
        IsConti: 0
      }, function(data) {
        done = true;
        resolve(data);
      });
      setTimeout(function() {
        if (!done) reject(new Error('Request timed out'));
      }, 15000);
    });
  }
  try {
    await waitForReady(10000);
    var xh = Global.UserInfo && Global.UserInfo.UserID;
    var year = Global.UniversityInfo && Global.UniversityInfo.CurrentYear;
    var term = Global.UniversityInfo && Global.UniversityInfo.CurrentTerm;
    log('master user=' + xh + ' term=' + year + '-' + term);
    if (!xh || !year || !term) {
      post({type:'error', message:${jsString(messages.fetchUserFailed)}});
      return;
    }
    var rows = await fetchRows(xh, year, term);
    post({
      type:'masterRows',
      data: Array.isArray(rows) ? rows : [],
      term: year + '-' + term,
      termStart: formatDate(Global.UniversityInfo.CurrentTermFrom)
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

export function isMasterRowsMessage(msg: unknown): msg is MasterRowsMessage {
  return (
    typeof msg === "object" &&
    msg !== null &&
    "type" in msg &&
    msg.type === "masterRows"
  );
}

export function normalizeMasterRowsMessage(
  msg: MasterRowsMessage,
): MasterRowsImportResult {
  const rawRows: MasterTimeTableRow[] = Array.isArray(msg.data) ? msg.data : [];
  const courses = parseMasterCourseRows(rawRows).map((course) => ({
    ...course,
    source: "imported" as const,
  }));

  return {
    courses,
    term: msg.term ? String(msg.term) : "",
    termStart: msg.termStart ? String(msg.termStart) : "",
  };
}
