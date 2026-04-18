import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";
import { router, Stack } from "expo-router";
import { useRef } from "react";
import { View } from "react-native";
import Toast from "react-native-toast-message";
import { WebView, type WebViewNavigation } from "react-native-webview";

import { useZhlgdAutoLogin } from "@/hooks/use-zhlgd-autologin";
import { reportError } from "@/lib/report";
import { getTermStart } from "@/services/get-course";
import { Course, useCourseStore } from "@/store/course";

export default function MasterCourseScreen() {
  const isImporting = useRef(false);
  const webview = useRef<WebView>(null);
  const { onLoadEnd: autoLoginOnLoadEnd } = useZhlgdAutoLogin(webview);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: "研究生课表导入" }} />

      <WebView
        source={{
          uri: "https://zhlgd.whut.edu.cn/tpass/login?service=https%3a%2f%2fyjsgl.whut.edu.cn%2fcas%2fCasLogin.ashx%3fredirectUrl%3d",
        }}
        style={{ flex: 1 }}
        javaScriptEnabled
        originWhitelist={["*"]}
        onLoadEnd={autoLoginOnLoadEnd}
        onNavigationStateChange={(state: WebViewNavigation) => {
          if (
            !isImporting.current &&
            state.url.startsWith("https://yjsgl.whut.edu.cn/MainFrame.htm")
          ) {
            isImporting.current = true;

            setTimeout(() => {
              webview.current?.injectJavaScript(
                `MenuDataManage.addTab('我的课程表','html/Student/StuCul_TimetableQry.htm','','8124');0; true;`,
              );

              setTimeout(async () => {
                const asset = Asset.fromModule(
                  // eslint-disable-next-line @typescript-eslint/no-require-imports
                  require("@/assets/js/parse.js.txt"),
                );
                await asset.downloadAsync();
                const script = await FileSystem.readAsStringAsync(
                  asset.localUri!,
                );
                webview.current?.injectJavaScript(
                  script +
                    "\nwindow.ReactNativeWebView.postMessage(JSON.stringify(u)); true;",
                );
              }, 3000);
            }, 3000);
          }
        }}
        onMessage={(event) => {
          try {
            const courses: Course[] = JSON.parse(event.nativeEvent.data).map(
              (c: any) => ({
                name: c.name,
                room: c.room,
                weekStart: c.weekStart,
                weekEnd: c.weekEnd,
                day: c.weekDay,
                sectionStart: c.sectionStart,
                sectionEnd: c.sectionEnd,
              }),
            );

            const store = useCourseStore.getState();
            store.setCourses(courses);

            getTermStart()
              .then((termStart) => store.setTermStart(termStart))
              .catch(() => {});

            Toast.show({
              type: "success",
              text1: "导入成功",
              text2: "好耶！",
              position: "bottom",
            });

            router.back();
          } catch (e) {
            reportError(e, { module: "course-master" });
            Toast.show({
              type: "error",
              text1: "导入失败",
              text2: "解析错误，请重试",
              position: "bottom",
            });
          }
        }}
        ref={webview}
      />
    </View>
  );
}
