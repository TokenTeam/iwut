/** 判断 fetch 失败是否为普通网络错误（超时中断、断网），这类错误无需上报 */
export function isNetworkError(err: unknown): boolean {
  // Hermes (the RN JS engine) does not expose DOMException globally, so a
  // bare `instanceof DOMException` throws a ReferenceError before the caller
  // ever sees the original network failure. Guard the lookup defensively.
  if (typeof DOMException !== "undefined" && err instanceof DOMException) {
    return err.name === "AbortError";
  }
  if (
    err &&
    typeof err === "object" &&
    (err as { name?: string }).name === "AbortError"
  ) {
    return true;
  }
  return err instanceof TypeError;
}
