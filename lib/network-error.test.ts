import { describe, expect, test } from "bun:test";

import { isNetworkError } from "./network-error";
import { WebViewLoadError } from "./webview-error";

describe("isNetworkError", () => {
  test.each([
    new Error("Network request failed"),
    new Error("Request timed out after 10000ms"),
    new Error("net::ERR_INTERNET_DISCONNECTED"),
    new Error("Unable to resolve host example.com"),
    { name: "AbortError", message: "The operation was aborted" },
    { code: "ENETUNREACH", message: "Network is unreachable" },
    { cause: { code: "ECONNRESET" } },
    new WebViewLoadError({
      code: -2,
      description: "net::ERR_NAME_NOT_RESOLVED",
    }),
    new WebViewLoadError({
      code: -1009,
      description: "The Internet connection appears to be offline.",
      domain: "NSURLErrorDomain",
    }),
    { code: "NETWORK_TIMEOUT", message: "加载超时，请检查网络连接并重试" },
  ])("recognizes expected network failures", (error) => {
    expect(isNetworkError(error)).toBe(true);
  });

  test.each([
    "fetch failed: FetchRequestCanceledException: Fetch request has been canceled (at Expo/NativeResponse.swift:63)",
    "fetch failed: UnexpectedException: 似乎已断开与互联网的连接。 (at ExpoModulesCore/Promise.swift:56)",
  ])("recognizes Expo native fetch failures: %s", (message) => {
    expect(isNetworkError(new Error(message))).toBe(true);
    expect(isNetworkError(message)).toBe(true);
    expect(isNetworkError({ name: "Error", message })).toBe(true);
    expect(isNetworkError({ cause: new Error(message) })).toBe(true);
  });

  test("recognizes the native Expo cancellation exception by name", () => {
    expect(isNetworkError({ name: "FetchRequestCanceledException" })).toBe(
      true,
    );
  });

  test.each([
    new TypeError("Cannot read properties of undefined"),
    new Error("Invalid HTTP response: missing status line"),
    new Error("Course data parsing failed"),
    new Error("fetch failed: UnexpectedException: Invalid response data"),
    new Error("fetch failed: UnexpectedException: SSL handshake failed"),
    new Error("fetch failed"),
    new WebViewLoadError({ code: -11, description: "SSL handshake failed" }),
    new WebViewLoadError({
      code: -1202,
      description: "The certificate for this server is invalid.",
      domain: "NSURLErrorDomain",
    }),
  ])("keeps programming and data errors reportable", (error) => {
    expect(isNetworkError(error)).toBe(false);
  });
});
