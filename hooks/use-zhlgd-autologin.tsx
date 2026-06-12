import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { WebView, WebViewMessageEvent } from "react-native-webview";

import { SmsPrompt } from "@/components/ui/sms-prompt";
import { useUserBindStore } from "@/store/user-bind";

const LOGIN_URL_PATTERN = "zhlgd.whut.edu.cn/tpass/login";

function buildAgentScript(username: string, password: string) {
  const u = JSON.stringify(username);
  const p = JSON.stringify(password);
  return `(function(){
  if (window.__zhlgdAuto) { window.__zhlgdAuto.kick(); return; }
  var USER=${u}, PASS=${p};
  var passwordFilled=false;
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
    if (btn) setTimeout(function(){ try{btn.click();}catch(e){} },120);
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
      var pm=document.querySelector('#PM1');
      if (!pm) return false;
      setVal(pm,String(code));
      var btn=document.querySelector('#index_login_btn');
      if (btn) setTimeout(function(){ try{btn.click();}catch(e){} },80);
      smsReportedAt=Date.now();
      return true;
    },
    kick:function(){
      passwordFilled=false; smsReportedAt=0;
      if(!timer){ timer=setInterval(tick,300); }
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
  options?: { onCancel?: () => void },
) {
  const creds = useRef<{ username: string; password: string } | null>(null);
  const lastFilledUrl = useRef("");
  const [sms, setSms] = useState<SmsState>(INITIAL_SMS);
  const [code, setCode] = useState("");
  const onCancelRef = useRef(options?.onCancel);
  onCancelRef.current = options?.onCancel;

  useEffect(() => {
    useUserBindStore
      .getState()
      .getCredentials()
      .then((c) => {
        creds.current = c;
      });
  }, []);

  const onLoadEnd = useCallback(
    (e: { nativeEvent: { url: string } }) => {
      const url = e.nativeEvent.url;
      if (!url.includes(LOGIN_URL_PATTERN)) {
        lastFilledUrl.current = "";
        setSms((s) => (s.visible ? INITIAL_SMS : s));
        setCode("");
        // SPA 式跳转不会重建 JS 上下文，离开登录页后停掉轮询定时器
        webviewRef.current?.injectJavaScript(
          "window.__zhlgdAuto && window.__zhlgdAuto.stop && window.__zhlgdAuto.stop();true;",
        );
        return;
      }

      if (!creds.current || lastFilledUrl.current === url) return;
      lastFilledUrl.current = url;

      webviewRef.current?.injectJavaScript(
        buildAgentScript(creds.current.username, creds.current.password),
      );
    },
    [webviewRef],
  );

  const onMessage = useCallback((e: WebViewMessageEvent): boolean => {
    let msg: { type?: string; phoneTail?: string } | null = null;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return false;
    }
    if (!msg || msg.type !== "zhlgd_sms_required") return false;
    setSms({
      visible: true,
      phoneTail: msg.phoneTail || "",
      submitting: false,
    });
    setCode("");
    return true;
  }, []);

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
    onCancelRef.current?.();
  }, []);

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
