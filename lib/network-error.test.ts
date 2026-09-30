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
    new TypeError("Cannot read properties of undefined"),
    new Error("Invalid HTTP response: missing status line"),
    new Error("Course data parsing failed"),
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
