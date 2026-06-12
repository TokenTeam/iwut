import { IS_DEV } from "@/constants/is-dev";

/**
 * Native RPC 仅向自有受信域名开放。校园页面的自动登录
 * 走独立的 postMessage 通道，不依赖 RPC，因此无需放行。
 */
const TRUSTED_HOST_SUFFIXES = ["tokenteam.net"];

export function isTrustedRpcOrigin(pageUrl: string | undefined): boolean {
  if (!pageUrl) return false;

  let url: URL;
  try {
    url = new URL(pageUrl);
  } catch {
    return false;
  }

  // 开发构建允许任意页面调试 RPC
  if (IS_DEV) return true;

  if (url.protocol !== "https:") return false;

  const hostname = url.hostname.toLowerCase();
  return TRUSTED_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
  );
}
