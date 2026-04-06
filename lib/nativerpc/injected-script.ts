export const NATIVE_RPC_INJECTED_JAVASCRIPT = `
(function () {
  if (window.bridge && window.bridge.__iwutNativeInjected) {
    return;
  }

  function postMessage(message) {
    var serialized =
      typeof message === "string" ? message : JSON.stringify(message);

    if (
      window.ReactNativeWebView &&
      typeof window.ReactNativeWebView.postMessage === "function"
    ) {
      window.ReactNativeWebView.postMessage(serialized);
      return;
    }

    throw new Error("NativeRPC bridge unavailable");
  }

  var bridge = {
    __iwutNativeInjected: true,
    postMessage: postMessage,
  };

  window.androidBridge = bridge;
  window.bridge = bridge;
})();
true;
`;
