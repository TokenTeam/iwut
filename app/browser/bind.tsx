import { IS_DEV } from "@/constants/is-dev";
import { useT } from "@/lib/i18n";
import { reportError } from "@/lib/report";
import { useUserBindStore } from "@/store/user-bind";
import CookieManager from "@preeternal/react-native-cookie-manager";
import { router, Stack } from "expo-router";
import { useEffect, useRef } from "react";
import { View } from "react-native";
import Toast from "react-native-toast-message";
import { WebView, type WebViewNavigation } from "react-native-webview";
import type {
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
} from "react-native-webview/lib/WebViewTypes";

const TALENT_HOST = "talent.whut.edu.cn";
const CAS_LOGIN = "zhlgd.whut.edu.cn/tpass/login";
const TALENT_ROOT_URL = `https://${TALENT_HOST}/`;
const TALENT_APP_PATH = "/information-center/center/index.html?appId=2";
const TALENT_CAS_URL = `https://zhlgd.whut.edu.cn/tpass/login?service=${encodeURIComponent(
  TALENT_ROOT_URL,
)}`;

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
    u.addEventListener('change',send);
    p.addEventListener('change',send);
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
    window.__talentTries=(window.__talentTries||0)+1;
    var giveUp=window.__talentTries>=8;
    function retry(){
      if(giveUp)return false;
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
      if(!u||u.code!==0||!u.data||!u.data.sn){retry();return;}
      var sn=String(u.data.sn);
      var name=u.data.name||'';
      Promise.all([
        getJson('/information-center/xd/user/findStudentInfoWechat/'+encodeURIComponent(sn)).catch(function(){return null;}),
        getJson('/information-center/xd/commons/getColleges').catch(function(){return null;}),
        getJson('/information-center/xd/commons/getDictionByName/'+encodeURIComponent('\u5b66\u751f\u7c7b\u578b')).catch(function(){return null;})
      ]).then(function(rs){
        var stu=rs[0];
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
  const t = useT();
  const webview = useRef<WebView>(null);
  const pendingCredentials = useRef<{
    username: string;
    password: string;
  } | null>(null);
  const isBound = useRef(false);
  const hasFailed = useRef(false);

  useEffect(() => {
    return () => {
      if (!isBound.current) {
        CookieManager.clearAll(true).catch(() => {});
      }
    };
  }, []);

  const handleFailure = () => {
    if (isBound.current || hasFailed.current) return;
    hasFailed.current = true;
    Toast.show({
      type: "error",
      text1: t("user.bindFailed"),
      text2: t("user.bindFailedSub"),
      position: "bottom",
    });
    if (router.canGoBack()) router.back();
  };

  const onError = (event: WebViewErrorEvent) => {
    const { url } = event.nativeEvent;
    if (url && url.includes(TALENT_HOST)) {
      handleFailure();
    }
  };

  const onHttpError = (event: WebViewHttpErrorEvent) => {
    const { url, statusCode } = event.nativeEvent;
    if (url && url.includes(TALENT_HOST) && statusCode >= 500) {
      handleFailure();
    }
  };

  const onNavigationStateChange = (state: WebViewNavigation) => {
    if (isBound.current || state.url.startsWith("about:") || state.url === "")
      return;

    const isLoginPage = state.url.includes(CAS_LOGIN);
    if (isLoginPage || !pendingCredentials.current) return;

    const isOnTalent = state.url.includes(TALENT_HOST);
    if (!isOnTalent) {
      webview.current?.injectJavaScript(
        `window.location.href="${TALENT_CAS_URL}";`,
      );
    }
  };

  const onMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "credentials") {
        pendingCredentials.current = {
          username: msg.username,
          password: msg.password,
        };
      } else if (msg.type === "info" && pendingCredentials.current) {
        isBound.current = true;
        const { username, password } = pendingCredentials.current;

        useUserBindStore
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
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: t("user.bindScreenTitle") }} />

      <WebView
        ref={webview}
        source={{ uri: "https://zhlgd.whut.edu.cn/tpass/login" }}
        style={{ flex: 1 }}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        originWhitelist={["*"]}
        webviewDebuggingEnabled={IS_DEV}
        injectedJavaScript={INJECTED_JS}
        onNavigationStateChange={onNavigationStateChange}
        onMessage={onMessage}
        onError={onError}
        onHttpError={onHttpError}
      />
    </View>
  );
}
