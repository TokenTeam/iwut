import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import Toast from "react-native-toast-message";
import type { WebView, WebViewMessageEvent } from "react-native-webview";

import { SmsPrompt } from "@/components/ui/sms-prompt";
import { t } from "@/lib/i18n";
import { useUserBindStore } from "@/store/user-bind";

const LOGIN_URL_PATTERN = "zhlgd.whut.edu.cn/tpass/login";

function buildAgentScript(username: string, password: string) {
  const u = JSON.stringify(username);
  const p = JSON.stringify(password);
  return `(function(){
  if (window.__zhlgdAuto) { window.__zhlgdAuto.kick(); return; }
  var USER=${u}, PASS=${p};
  var passwordFilled=false;
  var passwordRejected=false;
  var smsReportedAt=0;
  var nativeSetter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
  function setVal(el,v){
    nativeSetter.call(el,v);
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function fillPassword(){
    if (passwordFilled) return;
    var u=document.querySelector('#un'), p=document.querySelector('#pd');
    if (!u||!p) return;
    var tab=document.querySelector('#password_login');
    if (tab && !/active/.test(tab.className||'')) { try{tab.click();}catch(e){} }
    setVal(u,USER); setVal(p,PASS);
    var btn=document.querySelector('#index_login_btn');
    if (btn) setTimeout(function(){ if(passwordRejected) return; try{btn.click();}catch(e){} },120);
    passwordFilled=true;
  }
  function reportSmsIfNeeded(){
    var pm=document.querySelector('#PM1');
    if (!pm) return;
    if (pm.offsetParent===null) return;
    var now=Date.now();
    if (smsReportedAt && now-smsReportedAt<5000) return;
    smsReportedAt=now;
    var tail='';
    var notice=document.querySelector('.login_box_title_notice');
    if (notice && notice.innerText){
      var m=notice.innerText.match(/[\\u5c3e\\u53f7\\u4e3a]?\\s*(\\d{3,})/);
      if (m) tail=m[1];
    }
    try{
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type:'zhlgd_sms_required',
        phoneTail:tail
      }));
    }catch(e){}
  }
  function tick(){
    if (passwordRejected) return;
    var error=document.querySelector('#errormsghide');
    if (error && /密码错误|Incorrect Password/.test(error.textContent||'')) {
      passwordRejected=true;
      window.__zhlgdAuto.stop();
      try{
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type:'zhlgd_password_error'
        }));
      }catch(e){}
      return;
    }
    if (document.querySelector('#PM1')) {
      reportSmsIfNeeded();
    } else if (document.querySelector('#un') && document.querySelector('#pd')) {
      fillPassword();
    } else {
      var tab=document.querySelector('#password_login');
      if (tab) { try{tab.click();}catch(e){} }
    }
  }
  window.__zhlgdAuto={
    fillSms:function(code){
      if (passwordRejected) return false;
      var pm=document.querySelector('#PM1');
      if (!pm) return false;
      setVal(pm,String(code));
      var btn=document.querySelector('#index_login_btn');
      if (btn) setTimeout(function(){ if(passwordRejected) return; try{btn.click();}catch(e){} },80);
      smsReportedAt=Date.now();
      return true;
    },
    kick:function(){
      if (passwordRejected) return;
      if(!timer){ timer=setInterval(tick,300); }
      tick();
    },
    stop:function(){ if(timer){ clearInterval(timer); timer=null; } }
  };
  var timer=setInterval(tick,300);
  tick();
})();true;`;
}

type SmsState = {
  visible: boolean;
  phoneTail: string;
  submitting: boolean;
};

const INITIAL_SMS: SmsState = {
  visible: false,
  phoneTail: "",
  submitting: false,
};

export function useZhlgdAutoLogin(
  webviewRef: RefObject<WebView | null>,
  options?: {
    onCancel?: () => void;
    onPasswordError?: () => void;
    silent?: boolean;
    onInteractionRequired?: () => void;
    onCredentialsUnavailable?: () => void;
  },
) {
  const creds = useRef<{ username: string; password: string } | null>(null);
  const passwordRejected = useRef(false);
  const currentLoginUrl = useRef("");
  const [sms, setSms] = useState<SmsState>(INITIAL_SMS);
  const [code, setCode] = useState("");
  const onCancel = options?.onCancel;
  const onPasswordError = options?.onPasswordError;
  const silent = options?.silent ?? false;
  const onInteractionRequired = options?.onInteractionRequired;
  const onCredentialsUnavailable = options?.onCredentialsUnavailable;

  const injectAutoLogin = useCallback(() => {
    if (!useUserBindStore.getState().isBound) {
      creds.current = null;
      return;
    }
    if (!creds.current || passwordRejected.current) return;
    webviewRef.current?.injectJavaScript(
      buildAgentScript(creds.current.username, creds.current.password),
    );
  }, [webviewRef]);

  useEffect(() => {
    let active = true;
    const userBind = useUserBindStore.getState();
    if (!userBind.isBound) return;

    userBind
      .getCredentials()
      .then((credentials) => {
        if (!active) return;
        creds.current = credentials;
        if (!credentials) onCredentialsUnavailable?.();
        if (credentials && currentLoginUrl.current) {
          injectAutoLogin();
        }
      })
      .catch(() => {
        if (active) onCredentialsUnavailable?.();
      });

    return () => {
      active = false;
    };
  }, [injectAutoLogin, onCredentialsUnavailable]);

  const onLoadEnd = useCallback(
    (e: { nativeEvent: { url: string } }) => {
      const url = e.nativeEvent.url;
      if (!url.includes(LOGIN_URL_PATTERN)) {
        currentLoginUrl.current = "";
        setSms((s) => (s.visible ? INITIAL_SMS : s));
        setCode("");
        // 单页跳转会保留脚本上下文，离开登录页后停止轮询
        webviewRef.current?.injectJavaScript(
          "window.__zhlgdAuto && window.__zhlgdAuto.stop && window.__zhlgdAuto.stop();true;",
        );
        return;
      }

      currentLoginUrl.current = url;
      injectAutoLogin();
    },
    [injectAutoLogin, webviewRef],
  );

  const onMessage = useCallback(
    (e: WebViewMessageEvent): boolean => {
      let msg: { type?: string; phoneTail?: string } | null = null;
      try {
        msg = JSON.parse(e.nativeEvent.data);
      } catch {
        return false;
      }
      if (!msg) return false;
      if (msg.type === "zhlgd_password_error") {
        if (!e.nativeEvent.url.includes(LOGIN_URL_PATTERN)) return false;
        if (passwordRejected.current) return true;
        passwordRejected.current = true;
        creds.current = null;
        setSms(INITIAL_SMS);
        setCode("");
        if (!silent) {
          Toast.show({
            type: "error",
            text1: t("user.bindPasswordError"),
            text2: t("user.bindPasswordErrorSub"),
            position: "bottom",
          });
        }
        onPasswordError?.();
        return true;
      }
      if (msg.type !== "zhlgd_sms_required") return false;
      if (!e.nativeEvent.url.includes(LOGIN_URL_PATTERN)) return false;
      if (passwordRejected.current) return true;
      if (silent) {
        webviewRef.current?.injectJavaScript(
          "window.__zhlgdAuto && window.__zhlgdAuto.stop();true;",
        );
        onInteractionRequired?.();
        return true;
      }
      setSms({
        visible: true,
        phoneTail: msg.phoneTail || "",
        submitting: false,
      });
      setCode("");
      return true;
    },
    [onPasswordError, onInteractionRequired, silent, webviewRef],
  );

  const submitSms = useCallback(() => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setSms((s) => ({ ...s, submitting: true }));
    const payload = JSON.stringify(trimmed);
    webviewRef.current?.injectJavaScript(
      `window.__zhlgdAuto && window.__zhlgdAuto.fillSms(${payload});true;`,
    );
  }, [code, webviewRef]);

  const cancelSms = useCallback(() => {
    setSms(INITIAL_SMS);
    setCode("");
    onCancel?.();
  }, [onCancel]);

  const smsNode = (
    <SmsPrompt
      visible={sms.visible}
      phoneTail={sms.phoneTail}
      submitting={sms.submitting}
      code={code}
      onChangeCode={setCode}
      onSubmit={submitSms}
      onCancel={cancelSms}
    />
  );

  return { onLoadEnd, onMessage, sms, submitSms, cancelSms, smsNode };
}
