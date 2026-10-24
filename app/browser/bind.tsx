import { StackScreenContent } from "@/components/layout/stack-screen-content";
import { IS_DEV } from "@/constants/is-dev";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";
import { useT } from "@/lib/i18n";
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
const TALENT_APP_URL = `https://${TALENT_HOST}${TALENT_APP_PATH}`;
const TALENT_CAS_URL = `https://zhlgd.whut.edu.cn/tpass/login?service=${encodeURIComponent(
  TALENT_ROOT_URL,
)}`;

interface TalentLoginFailure {
  url?: string;
  statusCode?: number;
  description?: string;
}

function isTalentUrl(url?: string): boolean {
  if (!url) return false;
  try {
    return new URL(url).hostname === TALENT_HOST;
  } catch {
    return false;
  }
}

function isRecoverableTalentRootError({
  url,
  statusCode,
  description,
}: TalentLoginFailure): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    // Let the server consume the CAS ticket before recovering the bare root.
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
    function profileUnavailable(){
      if(window.__talentInfoSent)return;
      window.__talentInfoSent=true;
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'profileUnavailable'}));
    }
    window.__talentTries=(window.__talentTries||0)+1;
    var giveUp=window.__talentTries>=8;
    function retry(){
      if(giveUp){profileUnavailable();return false;}
      setTimeout(fetchTalentInfo,1000);
      return true;
    }
    function getJson(url,opts){
      return fetch(url, Object.assign({credentials:'include',headers:{'accept':'application/json'}}, opts||{}))
        .then(function(r){return r.json();});
    }
    function pick(arr,code){
      if(!arr||!arr.length)return '';
      for(var i=0;i<arr.length;i++){
        if(arr[i].fieldCode===code)return String(arr[i].fieldValue==null?'':arr[i].fieldValue);
      }
      return '';
    }
    getJson('/information-center/xd/user/getLoginUserNew/2').then(function(u){
      if(u&&u.code===50005){profileUnavailable();return;}
      if(!u||u.code!==0||!u.data||!u.data.sn){retry();return;}
      var sn=String(u.data.sn);
      var name=u.data.name||'';
      Promise.all([
        getJson('/information-center/xd/user/findStudentInfoWechat/'+encodeURIComponent(sn)).catch(function(){return null;}),
        getJson('/information-center/xd/commons/getColleges').catch(function(){return null;}),
        getJson('/information-center/xd/commons/getDictionByName/'+encodeURIComponent('\u5b66\u751f\u7c7b\u578b')).catch(function(){return null;})
      ]).then(function(rs){
        var stu=rs[0];
        if(stu&&stu.code===50005){profileUnavailable();return;}
        if(!giveUp && (!stu||stu.status!==true||!stu.data||!stu.data.expandField)){
          retry();return;
        }
        var cardId='',college='',eduLevel='';
        try{
          var ef=(stu&&stu.data&&stu.data.expandField)||{};
          var xj=ef['\u5b66\u7c4d\u4fe1\u606f']||[];
          cardId=pick(ef['\u57fa\u672c\u4fe1\u606f'],'card_no');
          var eduCode=pick(xj,'education_code');
          var eduDict=(rs[2]&&(rs[2].data||rs[2]))||[];
          if(eduCode&&Array.isArray(eduDict)){
            for(var j=0;j<eduDict.length;j++){
              if(eduDict[j].code===eduCode){eduLevel=eduDict[j].name||'';break;}
            }
          }
          var collegeCode=pick(xj,'college_code');
          var colleges=(rs[1]&&(rs[1].data||rs[1]))||[];
          if(collegeCode&&Array.isArray(colleges)){
            for(var i=0;i<colleges.length;i++){
              if(colleges[i].sn===collegeCode){college=colleges[i].name||'';break;}
            }
          }
        }catch(e){}
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
    // Native callbacks from the old WebView may arrive after recovery starts.
    if (webviewAttempt.id !== activeAttemptId.current || flowFinished.current)
      return true;
    if (webviewAttempt.id !== 0 || !isRecoverableTalentRootError(failure))
      return false;

    // Recreate the WebView to discard its built-in error state. Cookie storage
    // and pending credentials belong to this screen and survive the recovery.
    activeAttemptId.current += 1;
    setWebviewAttempt({ id: activeAttemptId.current, uri: TALENT_APP_URL });
    return true;
  };

  const onError = (event: WebViewErrorEvent) => {
    if (recoverAppEntry(event.nativeEvent)) {
      event.preventDefault();
      return;
    }
    const { url } = event.nativeEvent;
    if (isTalentUrl(url)) {
      handleFailure();
    }
  };

  const onHttpError = (event: WebViewHttpErrorEvent) => {
    if (recoverAppEntry(event.nativeEvent)) return;
    const { url, statusCode } = event.nativeEvent;
    if (isTalentUrl(url) && statusCode >= 400) {
      handleFailure();
    }
  };

  const onMessage = async (event: { nativeEvent: { data: string } }) => {
    if (webviewAttempt.id !== activeAttemptId.current) return;
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "credentials") {
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
