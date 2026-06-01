import type { Course } from "@/store/course";

export const BACHELOR_LOGIN_URL =
  "https://zhlgd.whut.edu.cn/tpass/login?service=https%3A%2F%2Fjwxt.whut.edu.cn%2Fjwapp%2Fsys%2Fhomeapp%2Findex.do%3FforceCas%3D1";
export const BACHELOR_HOME_PREFIX =
  "https://jwxt.whut.edu.cn/jwapp/sys/homeapp/";

export interface BachelorCoursesMessage {
  type: "courses";
  data?: unknown;
  termStart?: unknown;
}

export interface BachelorCoursesImportResult {
  courses: Course[];
  termStart: string;
}

function jsString(s: string): string {
  return JSON.stringify(s);
}

export function buildBachelorFetchScript(messages: {
  fetchUserFailed: string;
  noTermData: string;
}): string {
  return `(async function() {
  var log = function(s){ window.ReactNativeWebView.postMessage(JSON.stringify({type:'debug', message:s})); };
  try {
    log('script started, url=' + location.href);
    await fetch(
      '/jwapp/sys/homeapp/api/home/changeAppRole.do?appRole=ef212c48c8f84be79acbd9d81b090f51',
      {method:'POST', credentials:'include', headers:{'Content-Type':'application/x-www-form-urlencoded'}}
    );
    log('changeAppRole ok');
    var ud = ((await (await fetch('/jwapp/sys/homeapp/api/home/currentUser.do', {
      method:'GET', credentials:'include', headers:{'Fetch-Api':'true'}
    })).json()).datas) || {};
    var xh = ud.userId || '';
    var term = (ud.welcomeInfo && ud.welcomeInfo.xnxqdm) || '';
    log('user=' + xh + ' term=' + term);
    if (!xh || !term) {
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'error', message:${jsString(messages.fetchUserFailed)}}));
      return;
    }
    var resp = await fetch('/jwapp/sys/kcbcxby/modules/xskcb/cxxskcb.do', {
      method:'POST', credentials:'include',
      headers:{
        'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With':'XMLHttpRequest',
        'Accept':'application/json, text/javascript, */*; q=0.01'
      },
      body:'XH=' + encodeURIComponent(xh) + '&XNXQDM=' + encodeURIComponent(term)
    });
    var text = await resp.text();
    log(text.substring(0, 2000));
    var data = JSON.parse(text);
    var rows = data.datas && data.datas.cxxskcb && data.datas.cxxskcb.rows;
    if (!rows || !rows.length) {
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'error', message:${jsString(messages.noTermData)}.replace('{term}', term)}));
      return;
    }
    var courses = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i], re = /1+/g, m;
      while ((m = re.exec(r.SKZC || '')) !== null) {
        courses.push({
          name: r.KCM || '', room: r.JASMC || '', teacher: r.SKJS || '',
          day: r.SKXQ, sectionStart: r.KSJC, sectionEnd: r.JSJC,
          weekStart: m.index + 1, weekEnd: m.index + m[0].length
        });
      }
    }
    var tp = term.split('-');
    var ljcResp = await fetch('/jwapp/sys/kcbcxby/modules/xskcb/cxxljc.do', {
      method:'POST', credentials:'include',
      headers:{
        'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With':'XMLHttpRequest'
      },
      body:'XN=' + encodeURIComponent(tp[0] + '-' + tp[1]) + '&XQ=' + encodeURIComponent(tp[2])
    });
    var ljcData = await ljcResp.json();
    log(JSON.stringify(ljcData));
    var ljcRows = ljcData.datas && ljcData.datas.cxxljc && ljcData.datas.cxxljc.rows;
    var termStart = (ljcRows && ljcRows[0] && ljcRows[0].XQKSRQ) ? ljcRows[0].XQKSRQ.split(' ')[0] : '';
    log('parsed ' + courses.length + ' courses');
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'courses', data: courses, termStart: termStart}));
  } catch(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type:'error',
      message: (e && e.message) ? String(e.message) : '',
      name: (e && e.name) ? String(e.name) : '',
      stack: (e && e.stack) ? String(e.stack).substring(0, 1000) : '',
      url: (typeof location !== 'undefined' && location.href) ? location.href : ''
    }));
  }
})(); true;`;
}

export function isBachelorCoursesMessage(
  msg: unknown,
): msg is BachelorCoursesMessage {
  return (
    typeof msg === "object" &&
    msg !== null &&
    "type" in msg &&
    msg.type === "courses"
  );
}

export function normalizeBachelorCoursesMessage(
  msg: BachelorCoursesMessage,
): BachelorCoursesImportResult {
  const raw = Array.isArray(msg.data) ? msg.data : [];
  const courses: Course[] = raw.map((course: any) => ({
    name: course.name,
    room: course.room,
    teacher: course.teacher,
    day: course.day,
    sectionStart: course.sectionStart,
    sectionEnd: course.sectionEnd,
    weekStart: course.weekStart,
    weekEnd: course.weekEnd,
    source: "imported" as const,
  }));

  return {
    courses,
    termStart: msg.termStart ? String(msg.termStart) : "",
  };
}
