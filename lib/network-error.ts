const NETWORK_ERROR_CODES = new Set([
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ENETDOWN",
  "ENETUNREACH",
  "ENOTFOUND",
  "ERR_CANCELED",
  "ERR_NETWORK",
  "ETIMEDOUT",
  "NETWORK_FAILURE",
  "NETWORK_TIMEOUT",
]);

// android.webkit.WebViewClient: host lookup, connect, I/O and timeout.
const ANDROID_WEBVIEW_NETWORK_ERROR_CODES = new Set([-2, -6, -7, -8]);

// Foundation NSURLErrorDomain: connectivity/availability failures only.
// SSL, malformed URL, authentication and response decoding errors stay reportable.
const IOS_WEBVIEW_NETWORK_ERROR_CODES = new Set([
  -1001, // timed out
  -1003, // cannot find host
  -1004, // cannot connect to host
  -1005, // network connection lost
  -1006, // DNS lookup failed
  -1008, // resource unavailable
  -1009, // not connected to internet
  -1018, // international roaming off
  -1019, // call is active
  -1020, // cellular data not allowed
]);

const NETWORK_ERROR_MESSAGES = [
  /network request failed/i,
  /failed to fetch/i,
  /internet connection appears to be offline/i,
  /network (?:is )?unreachable/i,
  /unable to resolve host/i,
  /could not connect to (?:the )?server/i,
  /could not resolve host/i,
  /connection (?:was )?(?:aborted|closed|refused|reset)/i,
  /connection reset by peer/i,
  /net::err_(?:address_unreachable|connection_aborted|connection_closed|connection_refused|connection_reset|connection_timed_out|internet_disconnected|name_not_resolved|network_access_denied|network_changed|network_io_suspended|proxy_connection_failed|timed_out)/i,
  /request timed out(?: after \d+ms)?/i,
  /socket is not connected/i,
  /software caused connection abort/i,
];

type ErrorLike = {
  cause?: unknown;
  code?: unknown;
  domain?: unknown;
  message?: unknown;
  name?: unknown;
};

/** 判断是否为预期内的断网、超时或主动取消 */
export function isNetworkError(error: unknown): boolean {
  return isNetworkErrorAtDepth(error, 0);
}

function isNetworkErrorAtDepth(error: unknown, depth: number): boolean {
  if (depth > 2 || !error) return false;

  if (typeof error === "string") {
    return NETWORK_ERROR_MESSAGES.some((pattern) => pattern.test(error));
  }

  if (typeof error !== "object") return false;

  const candidate = error as ErrorLike;
  if (candidate.name === "AbortError") return true;

  if (
    candidate.name === "WebViewLoadError" &&
    typeof candidate.code === "number"
  ) {
    if (candidate.domain === "NSURLErrorDomain") {
      return IOS_WEBVIEW_NETWORK_ERROR_CODES.has(candidate.code);
    }
    return ANDROID_WEBVIEW_NETWORK_ERROR_CODES.has(candidate.code);
  }

  if (
    typeof candidate.code === "string" &&
    NETWORK_ERROR_CODES.has(candidate.code.toUpperCase())
  ) {
    return true;
  }

  if (typeof candidate.message === "string") {
    const message = candidate.message;
    if (NETWORK_ERROR_MESSAGES.some((pattern) => pattern.test(message))) {
      return true;
    }
  }

  return isNetworkErrorAtDepth(candidate.cause, depth + 1);
}
