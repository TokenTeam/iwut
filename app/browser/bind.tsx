import { StackScreenContent } from "@/components/layout/stack-screen-content";
import { IS_DEV } from "@/constants/is-dev";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";
import { useT } from "@/lib/i18n";
import { logger } from "@/lib/logger";
import { reportError } from "@/lib/report";
import { useOnboardingStore } from "@/store/onboarding";
import { useUserBindStore } from "@/store/user-bind";
import CookieManager from "@preeternal/react-native-cookie-manager";
import { router, Stack } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Toast from "react-native-toast-message";
import { WebView } from "react-native-webview";
import type {
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
} from "react-native-webview/lib/WebViewTypes";

const TALENT_HOST = "talent.whut.edu.cn";
const TALENT_ROOT_URL = `https://${TALENT_HOST}/`;
const TALENT_APP_PATH = "/information-center/center/index.html?appId=2";
const TALENT_CAS_URL = `https://zhlgd.whut.edu.cn/tpass/login?service=${encodeURIComponent(
  TALENT_ROOT_URL,
)}`;

interface TalentLoginFailure {
  url?: string;
  statusCode?: number;
  description?: string;
}

const DIAGNOSTIC_ENDPOINTS = [
  "loginUser",
  "studentInfo",
  "colleges",
  "education",
  "talentPage",
  "casPage",
] as const;
const DIAGNOSTIC_KINDS = [
  "http",
  "invalid-json",
  "invalid-response",
  "network",
  "load",
] as const;

function createBindErrorReporter(
  report: (error: Error, context: Record<string, unknown>) => void,
) {
  const reported = new Set<string>();
  return (raw: unknown) => {
    if (!raw || typeof raw !== "object") return;
    const candidate = raw as Record<string, unknown>;
    const endpoint = DIAGNOSTIC_ENDPOINTS.find(
      (value) => value === candidate.endpoint,
    );
    const kind = DIAGNOSTIC_KINDS.find((value) => value === candidate.kind);
    if (!endpoint || !kind) return;
    const key = kind === "network" ? `${endpoint}:network` : endpoint;
    if (reported.has(key)) return;
    reported.add(key);

    const context: Record<string, unknown> = { module: "bind", endpoint, kind };
    for (const key of ["statusCode", "attempt", "code"]) {
      const value = candidate[key];
      if (typeof value === "number" && Number.isSafeInteger(value)) {
        context[key] = value;
      }
    }
    const error = new Error(`Bind ${endpoint}: ${kind}`);
    if (kind === "network") {
      Object.assign(error, { code: "NETWORK_FAILURE" });
    } else if (kind === "load") {
      error.name = "WebViewLoadError";
      Object.assign(error, { code: context.code });
      if (candidate.domain === "NSURLErrorDomain") {
        Object.assign(error, { domain: "NSURLErrorDomain" });
        context.domain = "NSURLErrorDomain";
      }
    }
    report(error, context);
  };
}

function getLoginPage(url?: string) {
  if (!url) return;
  try {
    const host = new URL(url).hostname;
    if (host === TALENT_HOST) return "talentPage";
    if (host === "zhlgd.whut.edu.cn") return "casPage";
  } catch {}
}

function isRecoverableTalentRootError({
  url,
  statusCode,
  description,
}: TalentLoginFailure): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    // 带 ticket 的请求仍需由服务端处理
    if (
      parsed.origin !== TALENT_ROOT_URL.slice(0, -1) ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search
    ) {
      return false;
    }
  } catch {
    return false;
  }

  if (statusCode !== undefined) return statusCode === 404;
  return /\bnet::ERR_HTTP_RESPONSE_CODE_FAILURE\b/.test(description ?? "");
}

const INJECTED_JS = `(function(){
  function diagnostic(endpoint,kind,statusCode){
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type:'diagnostic',endpoint:endpoint,kind:kind,
      statusCode:statusCode,attempt:window.__talentTries
    }));
  }
  function isRecord(value){
    return value!==null && typeof value==='object' && !Array.isArray(value);
  }
  function isDictionary(value){
    return Array.isArray(value) && value.every(isRecord);
  }
  function getJson(endpoint,url){
    return fetch(url,{credentials:'include',headers:{accept:'application/json'}})
      .then(function(response){
        if(!response.ok){
          diagnostic(endpoint,'http',response.status);
          throw new Error('http');
        }
        return response.json().catch(function(){
          diagnostic(endpoint,'invalid-json',response.status);
          throw new Error('invalid-json');
        });
      },function(){
        diagnostic(endpoint,'network');
        throw new Error('network');
      });
  }
  function getDictionary(endpoint,url){
    return getJson(endpoint,url).then(function(value){
      var data=isRecord(value)?value.data:value;
      if((isRecord(value) && value.code!==undefined && value.code!==0) ||
        !isDictionary(data)){
        diagnostic(endpoint,'invalid-response');
        return null;
      }
      return data;
    }).catch(function(){return null;});
  }
  function simplifyLogin(){
    if(!document.head){setTimeout(simplifyLogin,100);return;}
    var css=document.createElement('style');
    css.textContent=
      '.login_banner{display:none!important}'+
      '.login_box_tab{display:none!important}'+
      '.code-login{display:none!important}'+
      '.qq_bar{display:none!important}'+
      '.login_box_notice{display:none!important}'+
      '.new_student{display:none!important}'+
      '.dit-line{display:none!important}'+
      '.browser{display:none!important}'+
      '#footer,.footer-login{display:none!important}'+
      '.content_login_box{float:none!important;margin:0 auto!important}';
    document.head.appendChild(css);

    var tries=0;
    function ensureAccountTab(){
      if(document.querySelector('#PM1'))return;
      var u=document.querySelector('#un');
      if(u && u.offsetParent!==null)return;
      var tab=document.querySelector('#password_login');
      if(tab){try{tab.click();}catch(e){}}
      if(++tries<20)setTimeout(ensureAccountTab,200);
    }
    ensureAccountTab();
  }

  function track(){
    var u=document.querySelector('#un');
    var p=document.querySelector('#pd');
    if(!u||!p){setTimeout(track,300);return;}
    function send(){
      if(u.value&&p.value){
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type:'credentials',username:u.value,password:p.value
        }));
      }
    }
    u.addEventListener('input',send);
    p.addEventListener('input',send);
    var btn=document.querySelector('#index_login_btn');
    if(btn)btn.addEventListener('click',send);
    document.addEventListener('submit',send,true);
  }
  function ensureAppEntry(){
    if(location.hostname!=='talent.whut.edu.cn')return false;
    if(location.pathname.indexOf('/information-center/center/')===0)return false;
    if(window.__talentRedirected)return false;
    window.__talentRedirected=true;
    try{location.replace('${TALENT_APP_PATH}');}catch(_){location.href='${TALENT_APP_PATH}';}
    return true;
  }
  function fetchTalentInfo(){
    if(location.hostname!=='talent.whut.edu.cn')return;
    if(window.__talentInfoSent)return;
    function finish(type){
      if(window.__talentInfoSent)return;
      window.__talentInfoSent=true;
      window.ReactNativeWebView.postMessage(JSON.stringify({type:type}));
    }
    window.__talentTries=(window.__talentTries||0)+1;
    var giveUp=window.__talentTries>=8;
    function retry(){
      if(giveUp){
        finish('bindingFailed');
        return false;
      }
      setTimeout(fetchTalentInfo,1000);
      return true;
    }
    function pick(arr,code){
      if(!arr||!arr.length)return '';
      for(var i=0;i<arr.length;i++){
        if(arr[i].fieldCode===code)return String(arr[i].fieldValue==null?'':arr[i].fieldValue);
      }
      return '';
    }
    getJson('loginUser','/information-center/xd/user/getLoginUserNew/2').then(function(u){
      if(u&&u.code===50005){finish('profileUnavailable');return;}
      if(!isRecord(u)||u.code!==0||!isRecord(u.data)||!u.data.sn){
        diagnostic('loginUser','invalid-response');retry();return;
      }
      var sn=String(u.data.sn);
      var name=u.data.name||'';
      Promise.all([
        getJson('studentInfo','/information-center/xd/user/findStudentInfoWechat/'+encodeURIComponent(sn)).catch(function(){return undefined;}),
        getDictionary('colleges','/information-center/xd/commons/getColleges'),
        getDictionary('education','/information-center/xd/commons/getDictionByName/'+encodeURIComponent('\u5b66\u751f\u7c7b\u578b'))
      ]).then(function(rs){
        var stu=rs[0];
        if(stu&&stu.code===50005){finish('profileUnavailable');return;}
        if(!isRecord(stu)||stu.status!==true||!isRecord(stu.data)||
          !isRecord(stu.data.expandField)){
          if(stu!==undefined)diagnostic('studentInfo','invalid-response');
          retry();return;
        }
        var cardId='',college='',eduLevel='';
        try{
          var ef=stu.data.expandField;
          if(['\u5b66\u7c4d\u4fe1\u606f','\u57fa\u672c\u4fe1\u606f'].some(function(key){
            return ef[key]!==undefined && !isDictionary(ef[key]);
          })){
            diagnostic('studentInfo','invalid-response');retry();return;
          }
          var xj=ef['\u5b66\u7c4d\u4fe1\u606f']||[];
          cardId=pick(ef['\u57fa\u672c\u4fe1\u606f'],'card_no');
          var eduCode=pick(xj,'education_code');
          var eduDict=rs[2]||[];
          if(eduCode){
            for(var j=0;j<eduDict.length;j++){
              if(eduDict[j].code===eduCode){eduLevel=eduDict[j].name||'';break;}
            }
          }
          var collegeCode=pick(xj,'college_code');
          var colleges=rs[1]||[];
          if(collegeCode){
            for(var i=0;i<colleges.length;i++){
              if(colleges[i].sn===collegeCode){college=colleges[i].name||'';break;}
            }
          }
        }catch(e){diagnostic('studentInfo','invalid-response');retry();return;}
        window.__talentInfoSent=true;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type:'info',
          name:name,
          studentId:sn,
          cardId:cardId,
          college:college,
          eduLevel:eduLevel
        }));
      });
    }).catch(function(){retry();});
  }

  if(/tpass\\/login/.test(window.location.href)){
    simplifyLogin();
  }
  if(!ensureAppEntry()){
    track();
    fetchTalentInfo();
  }
})();true;`;

export default function BindScreen() {
  useMarkRouteInteractive();
  const t = useT();
  const webview = useRef<WebView>(null);
  const [webviewAttempt, setWebviewAttempt] = useState({
    id: 0,
    uri: TALENT_CAS_URL,
  });
  const activeAttemptId = useRef(0);
  const pendingCredentials = useRef<{
    username: string;
    password: string;
  } | null>(null);
  const flowFinished = useRef(false);
  const preserveSession = useRef(false);
  const reportBindError = useRef(createBindErrorReporter(reportError)).current;

  const setWebviewRef = useCallback((view: WebView | null) => {
    if (!view) webview.current?.clearCache(true);
    webview.current = view;
  }, []);

  const handleLoadEnd = useCallback(() => {
    if (webviewAttempt.id !== activeAttemptId.current || flowFinished.current)
      return;
    webview.current?.injectJavaScript(INJECTED_JS);
  }, [webviewAttempt.id]);

  useEffect(() => {
    return () => {
      if (!preserveSession.current) {
        CookieManager.clearAll(true).catch(() => {});
      }
    };
  }, []);

  const handleFailure = () => {
    if (flowFinished.current) return;
    flowFinished.current = true;
    Toast.show({
      type: "error",
      text1: t("user.bindFailed"),
      text2: t("user.bindFailedSub"),
      position: "bottom",
    });
    if (router.canGoBack()) router.back();
  };

  const recoverAppEntry = (failure: TalentLoginFailure) => {
    // 忽略旧 WebView 的延迟回调
    if (webviewAttempt.id !== activeAttemptId.current || flowFinished.current)
      return true;
    if (webviewAttempt.id !== 0 || !isRecoverableTalentRootError(failure))
      return false;

    // 重建 WebView，清除内置错误页
    activeAttemptId.current += 1;
    logger.extend("Bind").info("Recovering talent root 404", {
      attempt: activeAttemptId.current,
    });
    setWebviewAttempt({
      id: activeAttemptId.current,
      uri: `https://${TALENT_HOST}${TALENT_APP_PATH}`,
    });
    return true;
  };

  const onError = (event: WebViewErrorEvent) => {
    if (recoverAppEntry(event.nativeEvent)) {
      event.preventDefault();
      return;
    }
    const { url } = event.nativeEvent;
    const endpoint = getLoginPage(url);
    if (endpoint) {
      reportBindError({
        endpoint,
        kind: "load",
        code: event.nativeEvent.code,
        domain: event.nativeEvent.domain,
        attempt: webviewAttempt.id,
      });
      handleFailure();
    }
  };

  const onHttpError = (event: WebViewHttpErrorEvent) => {
    if (recoverAppEntry(event.nativeEvent)) return;
    const { url, statusCode } = event.nativeEvent;
    const endpoint = getLoginPage(url);
    if (endpoint && statusCode >= 400) {
      reportBindError({
        endpoint,
        kind: "http",
        statusCode,
        attempt: webviewAttempt.id,
      });
      handleFailure();
    }
  };

  const onMessage = async (event: { nativeEvent: { data: string } }) => {
    if (webviewAttempt.id !== activeAttemptId.current) return;
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "diagnostic") {
        reportBindError(msg);
      } else if (msg.type === "bindingFailed") {
        handleFailure();
      } else if (msg.type === "credentials") {
        pendingCredentials.current = {
          username: msg.username,
          password: msg.password,
        };
      } else if (msg.type === "profileUnavailable") {
        if (flowFinished.current) return;
        flowFinished.current = true;
        preserveSession.current = true;
        useOnboardingStore.getState().reset();
        Toast.show({
          type: "info",
          text1: t("user.bindProfileUnavailable"),
          text2: t("user.bindProfileUnavailableSub"),
          position: "bottom",
        });
        router.replace({
          pathname: "/onboarding",
          params: { step: "setup" },
        });
      } else if (msg.type === "info" && pendingCredentials.current) {
        if (flowFinished.current) return;
        flowFinished.current = true;
        preserveSession.current = true;
        const { username, password } = pendingCredentials.current;

        await useUserBindStore
          .getState()
          .bind(
            username,
            msg.name,
            password,
            msg.cardId,
            msg.college,
            msg.eduLevel,
          );

        Toast.show({
          type: "success",
          text1: t("user.bindSuccess"),
          text2: t("user.bindSuccessSub", { username }),
          position: "bottom",
        });

        router.back();
      }
    } catch (e) {
      reportError(e, { module: "bind" });
    }
  };

  return (
    <StackScreenContent>
      <View style={{ flex: 1 }}>
        <Stack.Screen options={{ title: t("user.bindScreenTitle") }} />

        <WebView
          key={webviewAttempt.id}
          ref={setWebviewRef}
          source={{ uri: webviewAttempt.uri }}
          style={{ flex: 1 }}
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          sharedCookiesEnabled
          cacheEnabled={false}
          originWhitelist={["*"]}
          webviewDebuggingEnabled={IS_DEV}
          onLoadEnd={handleLoadEnd}
          onMessage={onMessage}
          onError={onError}
          onHttpError={onHttpError}
        />
      </View>
    </StackScreenContent>
  );
}
