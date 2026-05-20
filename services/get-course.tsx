import { Ionicons } from "@expo/vector-icons";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Modal, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Toast from "react-native-toast-message";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { IS_DEV } from "@/constants/is-dev";
import { useZhlgdAutoLogin } from "@/hooks/use-zhlgd-autologin";
import { useT } from "@/lib/i18n";
import { reportError } from "@/lib/report";
import { syncWidgetData } from "@/services/widget-sync";
import { type Course, type ImportType, useCourseStore } from "@/store/course";

// 本科生
const BACHELOR_LOGIN_URL =
  "https://zhlgd.whut.edu.cn/tpass/login?service=https%3A%2F%2Fjwxt.whut.edu.cn%2Fjwapp%2Fsys%2Fhomeapp%2Findex.do%3FforceCas%3D1";
const BACHELOR_HOME_PREFIX = "https://jwxt.whut.edu.cn/jwapp/sys/homeapp/";

function jsString(s: string): string {
  return JSON.stringify(s);
}

function buildBachelorFetchScript(messages: {
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

// 研究生
const MASTER_LOGIN_URL =
  "https://zhlgd.whut.edu.cn/tpass/login?service=https%3a%2f%2fyjsgl.whut.edu.cn%2fcas%2fCasLogin.ashx%3fredirectUrl%3d";
const MASTER_MAIN_PREFIX = "https://yjsgl.whut.edu.cn/MainFrame.htm";

const MASTER_NAV_SCRIPT = `MenuDataManage.addTab('我的课程表','html/Student/StuCul_TimetableQry.htm','','8124');0; true;`;

const MASTER_PARSE_SCRIPT = `(function() {
  function getSectionRange(s) {
    var parts = s.split(',');
    return { sectionStart: parseInt(parts[0], 10), sectionEnd: parseInt(parts[parts.length - 1], 10) };
  }
  function getCourseSections(m, sw) {
    if (sw === '第') return { sectionStart: parseInt(m[2], 10), sectionEnd: parseInt(m[2], 10) };
    return getSectionRange(m[2]);
  }
  function makeCourses(dow, name, teacher, sw, secStart, secEnd, room, wStart, wEnd) {
    var out = [];
    function push(ws, we) { out.push({ name: name, room: room, teacher: teacher, weekDay: dow, sectionStart: secStart, sectionEnd: secEnd, weekStart: ws, weekEnd: we }); }
    if (sw === '' || sw === '第') { push(wStart, wEnd); }
    else if (sw === '单周') { for (var j = wStart; j <= wEnd; j++) { if (j % 2 === 1) push(j, j); } }
    else if (sw === '双周') { for (var j = wStart; j <= wEnd; j++) { if (j % 2 === 0) push(j, j); } }
    return out;
  }
  function parseCourseBlock(lines, dow) {
    lines = lines.map(function(s) { return s.trim(); });
    var name = lines[0];
    var teacher = lines[1].split(' ')[0];
    var secMatch = lines[2].match(/节次:(.*?)[\\d,]+?)节/);
    if (!secMatch) return [];
    var sw = secMatch[1];
    var sec = getCourseSections(secMatch, sw);
    var weekText = lines[3];
    var room = lines[4].replace('地点:', '').trim();
    var courses = [];
    if (/\\)/.test(weekText)) {
      var re = /(\\d+)(?:-(\\d+))?\\((.+?)\\)/g, m;
      while ((m = re.exec(weekText)) !== null) {
        var ws = parseInt(m[1], 10);
        var we = m[2] ? parseInt(m[2], 10) : ws;
        courses = courses.concat(makeCourses(dow, name, m[3], sw, sec.sectionStart, sec.sectionEnd, room, ws, we));
      }
    } else {
      if (weekText.indexOf('周次:') === 0) weekText = weekText.slice(3);
      var weekList;
      if (weekText.indexOf('、') >= 0) weekList = weekText.split('、');
      else if (weekText.indexOf('，') >= 0) weekList = weekText.split('，');
      else weekList = weekText.split(',');
      weekList.forEach(function(span) {
        var parts = span.split('-');
        var ws = parseInt(parts[0], 10);
        var we = parseInt(parts[parts.length - 1], 10);
        courses = courses.concat(makeCourses(dow, name, teacher, sw, sec.sectionStart, sec.sectionEnd, room, ws, we));
      });
    }
    return courses;
  }
  var tbody = document.querySelector('.WtbodyZlistS');
  var tds = tbody ? Array.from(tbody.querySelectorAll('tr td')) : [];
  var courses = [];
  for (var i = 0; i < tds.length; i++) {
    var dow = (i % 9) - 1;
    if (dow <= 0) continue;
    var text = tds[i].innerText.trim().replace('\\r', '');
    if (!text.length) continue;
    var blocks = text.split('\\n\\n');
    for (var b = 0; b < blocks.length; b++) {
      var lines = blocks[b].split('\\n');
      if (lines.length === 5 && lines[0].indexOf('[考试]') === 0) {
        var examSec = lines[1].match(/节次:(.*?)[\\d,]+?)节/);
        if (!examSec || examSec.length < 3) continue;
        var week = parseInt(lines[2].split(':')[1], 10);
        var secInfo = getSectionRange(examSec[2]);
        courses.push({ name: lines[0], room: lines[3], teacher: '', weekDay: dow, weekStart: week, weekEnd: week, sectionStart: secInfo.sectionStart, sectionEnd: secInfo.sectionEnd });
      } else if (lines.length === 7) {
        courses = courses.concat(parseCourseBlock(lines, dow));
      }
    }
  }
  courses.sort(function(a, b) {
    if (a.weekDay !== b.weekDay) return a.weekDay - b.weekDay;
    if (a.weekStart !== b.weekStart) return a.weekStart - b.weekStart;
    if (a.sectionStart !== b.sectionStart) return a.sectionStart - b.sectionStart;
    return a.name.localeCompare(b.name);
  });
  var merged = [];
  for (var i = 0; i < courses.length; i++) {
    var c = courses[i];
    var prev = merged.length ? merged[merged.length - 1] : null;
    if (prev && prev.name === c.name && prev.teacher === c.teacher && prev.room === c.room && prev.weekDay === c.weekDay && prev.weekStart === c.weekStart && prev.weekEnd === c.weekEnd && prev.sectionEnd + 1 === c.sectionStart) {
      prev.sectionEnd = c.sectionEnd;
    } else {
      merged.push({ name: c.name, room: c.room, teacher: c.teacher, weekDay: c.weekDay, weekStart: c.weekStart, weekEnd: c.weekEnd, sectionStart: c.sectionStart, sectionEnd: c.sectionEnd });
    }
  }
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'courses', data: merged}));
})(); true;`;

export interface GetCourseHandle {
  startImport: (type: ImportType) => void;
}

export const GetCourse = forwardRef<GetCourseHandle>(
  function GetCourse(_, ref) {
    const t = useT();
    const [importing, setImporting] = useState(false);
    const [importType, setImportType] = useState<ImportType>("bachelor");
    const webview = useRef<WebView>(null);
    const injected = useRef(false);
    const finishRef = useRef<(success: boolean, message?: string) => void>(
      () => {},
    );
    const {
      onLoadEnd: autoLoginOnLoadEnd,
      onMessage: autoLoginOnMessage,
      sms,
      smsNode,
    } = useZhlgdAutoLogin(webview, {
      onCancel: () => finishRef.current(false, t("course.smsCancelled")),
    });

    useImperativeHandle(ref, () => ({
      startImport(type: ImportType) {
        injected.current = false;
        setImportType(type);
        setImporting(true);
      },
    }));

    const iconPulse = useSharedValue(0);
    const ripple = useSharedValue(0);

    useEffect(() => {
      if (importing) {
        iconPulse.value = withRepeat(
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          -1,
          true,
        );
        ripple.value = 0;
        ripple.value = withRepeat(
          withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }),
          -1,
          false,
        );
      } else {
        iconPulse.value = 0;
        ripple.value = 0;
      }
    }, [importing, iconPulse, ripple]);

    const iconStyle = useAnimatedStyle(() => ({
      opacity: interpolate(iconPulse.value, [0, 0.5, 1], [0.7, 1, 0.7]),
    }));

    const rippleStyle = useAnimatedStyle(() => ({
      transform: [{ scale: interpolate(ripple.value, [0, 1], [1, 1.8]) }],
      opacity: interpolate(ripple.value, [0, 0.4, 1], [0.4, 0.15, 0]),
    }));

    const finish = useCallback(
      (success: boolean, message?: string) => {
        setImporting(false);
        injected.current = false;
        if (success) {
          Toast.show({
            type: "success",
            text1: t("course.importSuccess"),
            text2: t("course.importSuccessSub"),
            position: "bottom",
          });
        } else {
          Toast.show({
            type: "error",
            text1: t("course.importFail"),
            text2: message || t("course.importFailSub"),
            position: "bottom",
          });
        }
      },
      [t],
    );
    finishRef.current = finish;

    useEffect(() => {
      if (!importing || sms.visible) return;
      const timeout = setTimeout(() => {
        if (!injected.current) {
          finish(false, t("course.importTimeout"));
        }
      }, 30000);
      return () => clearTimeout(timeout);
    }, [importing, sms.visible, finish, t]);

    const handleError = useCallback(
      (syntheticEvent: {
        nativeEvent: { description: string; url?: string; code?: number };
      }) => {
        const { description, url, code } = syntheticEvent.nativeEvent;
        reportError(new Error(description), {
          module: `course-${importType}`,
          webviewUrl: url,
          webviewCode: code,
        });
        finish(false, t("course.importFailSub"));
      },
      [importType, finish, t],
    );

    const handleLoadEnd = useCallback(
      (e: { nativeEvent: { url: string } }) => {
        autoLoginOnLoadEnd(e);
        if (injected.current) return;

        const url = e.nativeEvent.url;

        if (importType === "bachelor" && url.startsWith(BACHELOR_HOME_PREFIX)) {
          injected.current = true;
          const script = buildBachelorFetchScript({
            fetchUserFailed: t("course.fetchUserFailed"),
            noTermData: t("course.noTermData"),
          });
          setTimeout(() => {
            webview.current?.injectJavaScript(script);
          }, 1500);
        }

        if (importType === "master" && url.startsWith(MASTER_MAIN_PREFIX)) {
          injected.current = true;
          setTimeout(() => {
            webview.current?.injectJavaScript(MASTER_NAV_SCRIPT);
            setTimeout(() => {
              webview.current?.injectJavaScript(MASTER_PARSE_SCRIPT);
            }, 3000);
          }, 3000);
        }
      },
      [autoLoginOnLoadEnd, importType, t],
    );

    const handleMessage = useCallback(
      (event: WebViewMessageEvent) => {
        if (autoLoginOnMessage(event)) return;

        let msg: any;
        try {
          msg = JSON.parse(event.nativeEvent.data);
        } catch {
          return;
        }

        if (msg?.type === "debug") {
          console.log(importType, msg.message);
          return;
        }

        if (msg?.type === "error") {
          const err = new Error(msg.message || "Load failed");
          if (msg.name) err.name = String(msg.name);
          if (msg.stack) err.stack = String(msg.stack);
          reportError(err, {
            module: `course-${importType}`,
            webviewErrorName: msg.name,
            webviewErrorMessage: msg.message,
            webviewErrorStack: msg.stack,
            webviewUrl: msg.url,
          });
          finish(false, msg.message);
          return;
        }

        if (msg?.type === "courses") {
          const raw: any[] = msg.data ?? msg;
          const isMaster = importType === "master";

          const courses: Course[] = raw.map((c: any) => ({
            name: c.name,
            room: c.room,
            teacher: c.teacher,
            day: isMaster ? c.weekDay : c.day,
            sectionStart: c.sectionStart,
            sectionEnd: c.sectionEnd,
            weekStart: c.weekStart,
            weekEnd: c.weekEnd,
            source: "imported" as const,
          }));

          if (courses.length === 0) {
            finish(false, t("course.parseFailed"));
            return;
          }

          const store = useCourseStore.getState();
          store.setImportedCourses(courses);
          if (msg.termStart) store.setTermStart(msg.termStart);
          syncWidgetData().catch(() => {});
          finish(true);
          return;
        }

        if (Array.isArray(msg)) {
          const courses: Course[] = msg.map((c: any) => ({
            name: c.name,
            room: c.room,
            teacher: c.teacher,
            day: c.weekDay,
            sectionStart: c.sectionStart,
            sectionEnd: c.sectionEnd,
            weekStart: c.weekStart,
            weekEnd: c.weekEnd,
            source: "imported" as const,
          }));

          if (courses.length === 0) {
            finish(false, t("course.parseFailed"));
            return;
          }

          const store = useCourseStore.getState();
          store.setImportedCourses(courses);
          syncWidgetData().catch(() => {});
          finish(true);
        }
      },
      [importType, finish, autoLoginOnMessage, t],
    );

    if (!importing) return null;

    const loginUrl =
      importType === "bachelor" ? BACHELOR_LOGIN_URL : MASTER_LOGIN_URL;

    return (
      <Modal
        visible
        transparent
        animationType="fade"
        onRequestClose={() => finish(false, t("course.importCancelled"))}
      >
        <View style={{ flex: 1 }}>
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.45)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <View
              style={{
                backgroundColor: "white",
                borderRadius: 20,
                paddingHorizontal: 36,
                paddingVertical: 28,
                alignItems: "center",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 8,
              }}
            >
              <View
                style={{
                  width: 72,
                  height: 72,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Animated.View
                  style={[
                    {
                      position: "absolute",
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      backgroundColor: "#3b82f6",
                    },
                    rippleStyle,
                  ]}
                />
                <Animated.View style={iconStyle}>
                  <Ionicons
                    name="cloud-download-outline"
                    size={36}
                    color="#3b82f6"
                  />
                </Animated.View>
              </View>
              <Text
                style={{
                  marginTop: 14,
                  fontSize: 16,
                  fontWeight: "600",
                  color: "#1f2937",
                }}
              >
                {t("course.importing")}
              </Text>
              <Text
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  color: "#9ca3af",
                }}
              >
                {t("course.importingSub")}
              </Text>
            </View>
          </View>
          <View
            style={{
              position: "absolute",
              left: -9999,
              top: 0,
              width: 390,
              height: 844,
            }}
            pointerEvents="none"
          >
            <WebView
              source={{ uri: loginUrl }}
              style={{ flex: 1 }}
              javaScriptEnabled
              domStorageEnabled
              thirdPartyCookiesEnabled
              originWhitelist={["*"]}
              webviewDebuggingEnabled={IS_DEV}
              onLoadEnd={handleLoadEnd}
              onError={handleError}
              onHttpError={handleError}
              onMessage={handleMessage}
              ref={webview}
            />
          </View>
          {smsNode}
        </View>
      </Modal>
    );
  },
);
