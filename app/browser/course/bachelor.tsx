import { router, Stack } from "expo-router";
import { useRef } from "react";
import { View } from "react-native";
import Toast from "react-native-toast-message";
import { WebView, type WebViewNavigation } from "react-native-webview";

import { useZhlgdAutoLogin } from "@/hooks/use-zhlgd-autologin";
import { reportError } from "@/lib/report";
import { getTermStart } from "@/services/get-course";
import { type Course, useCourseStore } from "@/store/course";

const LOGIN_URL =
  "https://zhlgd.whut.edu.cn/tpass/login?service=https%3A%2F%2Fjwxt.whut.edu.cn%2Fjwapp%2Fsys%2Fhomeapp%2Findex.do%3FforceCas%3D1";

const HOME_PREFIX =
  "https://jwxt.whut.edu.cn/jwapp/sys/homeapp/home/index.html";

const COURSE_FETCH_SCRIPT = `(async function() {
  try {
    await fetch(
      '/jwapp/sys/homeapp/api/home/changeAppRole.do?appRole=ef212c48c8f84be79acbd9d81b090f51',
      {method:'POST', credentials:'include', headers:{'Content-Type':'application/x-www-form-urlencoded'}}
    );
    var termResp = await fetch('/jwapp/sys/homeapp/api/home/kb/xnxq.do', {
      method:'GET', credentials:'include', headers:{'Fetch-Api':'true'}
    });
    var termList = (await termResp.json()).datas || [];
    var term = '';
    for (var i = 0; i < termList.length; i++) {
      if (termList[i].selected) { term = termList[i].itemCode; break; }
    }
    if (!term) {
      var now = new Date(), y = now.getFullYear(), m = now.getMonth() + 1;
      var sy = m >= 9 ? y : y - 1;
      var sem = m >= 9 ? 1 : (m >= 2 ? 2 : 1);
      term = sy + '-' + (sy + 1) + '-' + sem;
    }
    var courseResp = await fetch(
      '/jwapp/sys/homeapp/api/home/student/courses.do?termCode=' + encodeURIComponent(term),
      {method:'GET', credentials:'include', headers:{'Fetch-Api':'true'}}
    );
    var courseData = await courseResp.json();
    if (!courseData.datas || courseData.datas.length === 0) {
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'error', message:'当前学期('+term+')无课程数据'}));
      return;
    }
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'courses', data:courseData.datas}));
  } catch(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'error', message:e.message||''}));
  }
})(); true;`;

const DAY_MAP: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  日: 7,
  天: 7,
};

function parseClassDateAndPlace(str: string): Omit<Course, "name">[] {
  const re =
    /\[([^\]]+)\]\s*星期([一二三四五六日天])\s*第(\d+)-(\d+)节\s*([^\[;]*)/g;
  const results: Omit<Course, "name">[] = [];
  let m: RegExpExecArray | null;

  while ((m = re.exec(str)) !== null) {
    const day = DAY_MAP[m[2]] ?? 0;
    const sectionStart = parseInt(m[3], 10);
    const sectionEnd = parseInt(m[4], 10);
    const room = m[5].trim();

    for (const part of m[1].split(",")) {
      const wm = part.match(/(\d+)(?:-(\d+))?/);
      if (wm) {
        results.push({
          room,
          day,
          sectionStart,
          sectionEnd,
          weekStart: parseInt(wm[1], 10),
          weekEnd: wm[2] ? parseInt(wm[2], 10) : parseInt(wm[1], 10),
        });
      }
    }
  }
  return results;
}

export default function BachelorCourseScreen() {
  const isImporting = useRef(false);
  const webview = useRef<WebView>(null);
  const { onLoadEnd: autoLoginOnLoadEnd } = useZhlgdAutoLogin(webview);

  const handleLoadEnd = (event: { nativeEvent: { url: string } }) => {
    autoLoginOnLoadEnd(event);
  };

  const handleNavStateChange = (state: WebViewNavigation) => {
    if (
      !isImporting.current &&
      !state.loading &&
      state.url.startsWith(HOME_PREFIX)
    ) {
      isImporting.current = true;
      setTimeout(() => {
        webview.current?.injectJavaScript(COURSE_FETCH_SCRIPT);
      }, 1500);
    }
  };

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      if (msg.type === "error") {
        isImporting.current = false;
        reportError(new Error(msg.message), { module: "course-bachelor" });
        Toast.show({
          type: "error",
          text1: "导入失败",
          text2: msg.message || "请检查网络连接并重试",
          position: "bottom",
        });
        return;
      }

      if (msg.type === "courses") {
        const courses: Course[] = (msg.data as any[]).flatMap((row: any) => {
          const parsed = parseClassDateAndPlace(row.classDateAndPlace ?? "");
          return parsed.map((c) => ({
            ...c,
            name: row.courseName ?? "",
          }));
        });

        if (courses.length === 0) {
          isImporting.current = false;
          Toast.show({
            type: "error",
            text1: "导入失败",
            text2: "课表数据解析失败",
            position: "bottom",
          });
          return;
        }

        const store = useCourseStore.getState();
        store.setCourses(courses);
        getTermStart()
          .then((ts) => store.setTermStart(ts))
          .catch(() => {});
        Toast.show({
          type: "success",
          text1: "导入成功",
          text2: "好耶！",
          position: "bottom",
        });
        router.back();
      }
    } catch (e) {
      reportError(e, { module: "course-bachelor" });
      isImporting.current = false;
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: "本科生课表导入" }} />

      <WebView
        source={{ uri: LOGIN_URL }}
        style={{ flex: 1 }}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        originWhitelist={["*"]}
        onLoadEnd={handleLoadEnd}
        onNavigationStateChange={handleNavStateChange}
        onMessage={handleMessage}
        ref={webview}
      />
    </View>
  );
}
