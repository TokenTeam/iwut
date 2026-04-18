import { reportError } from "@/lib/report";
import { useUserBindStore } from "@/store/user-bind";
import { router, Stack } from "expo-router";
import { useRef } from "react";
import { View } from "react-native";
import Toast from "react-native-toast-message";
import { WebView, type WebViewNavigation } from "react-native-webview";

const LIBRARY_HOST = "202.114.89.11";
const CAS_LOGIN = "zhlgd.whut.edu.cn/tpass/login";
const LIBRARY_CAS_URL =
  "https://zhlgd.whut.edu.cn/tpass/login?service=http%3A%2F%2F202.114.89.11%2Fopac%2Fspecial%2FtoOpac";
const READER_INFO_URL = `http://${LIBRARY_HOST}/opac/reader/getReaderInfo`;

const INJECTED_JS = `(function(){
  function simplifyLogin(){
    var pwdTab=document.querySelector('#password_login');
    if(!pwdTab){setTimeout(simplifyLogin,200);return;}

    pwdTab.click();

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
  function trackInfo(){
    try{
      var el=document.getElementsByName('rdName')[0];
      if(!el||!el.value){setTimeout(trackInfo,300);return;}
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type:'info',
        name:el.value,
        college:(document.getElementsByName('rdUnit')[0]||{}).value||'',
        studentId:(document.getElementsByName('workCardNo')[0]||{}).value||'',
        cardId:((document.getElementsByName('rdid')[0]||{}).value||'').slice(4),
        eduLevel:(document.getElementsByName('rdSort5')[0]||{}).value||''
      }));
    }catch(e){setTimeout(trackInfo,300);}
  }

  if(/tpass\\/login/.test(window.location.href)){
    simplifyLogin();
  }
  track();
  trackInfo();
})();true;`;

export default function BindScreen() {
  const webview = useRef<WebView>(null);
  const pendingCredentials = useRef<{
    username: string;
    password: string;
  } | null>(null);
  const isBound = useRef(false);

  const onNavigationStateChange = (state: WebViewNavigation) => {
    if (isBound.current || state.url.startsWith("about:") || state.url === "")
      return;

    const isLoginPage = state.url.includes(CAS_LOGIN);
    if (isLoginPage || !pendingCredentials.current) return;

    const isOnLibrary = state.url.includes(LIBRARY_HOST);
    if (!isOnLibrary) {
      webview.current?.injectJavaScript(
        `window.location.href="${LIBRARY_CAS_URL}";`,
      );
    } else if (state.url.includes("/opac/reader/space") && !state.loading) {
      webview.current?.injectJavaScript(
        `window.location.href="${READER_INFO_URL}";`,
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
          text1: "绑定成功",
          text2: `已绑定账号 ${username}`,
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
      <Stack.Screen options={{ title: "智慧理工大绑定" }} />

      <WebView
        ref={webview}
        source={{ uri: "https://zhlgd.whut.edu.cn/tpass/login" }}
        style={{ flex: 1 }}
        javaScriptEnabled
        originWhitelist={["*"]}
        injectedJavaScript={INJECTED_JS}
        onNavigationStateChange={onNavigationStateChange}
        onMessage={onMessage}
      />
    </View>
  );
}
