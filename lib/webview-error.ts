export interface WebViewLoadFailure {
  code: number;
  description?: string;
  domain?: string;
  url?: string;
}

export class WebViewLoadError extends Error {
  readonly code: number;
  readonly domain?: string;
  readonly url?: string;

  constructor({ code, description, domain, url }: WebViewLoadFailure) {
    super(description || `WebView load failed (${code})`);
    this.name = "WebViewLoadError";
    this.code = code;
    this.domain = domain;
    this.url = url;
  }
}

export interface WebViewHttpFailure {
  description?: string;
  statusCode: number;
  url?: string;
}

export class WebViewHttpStatusError extends Error {
  readonly statusCode: number;
  readonly url?: string;

  constructor({ description, statusCode, url }: WebViewHttpFailure) {
    super(description || `WebView HTTP ${statusCode}`);
    this.name = "WebViewHttpStatusError";
    this.statusCode = statusCode;
    this.url = url;
  }
}

export function createWebViewScriptError(details: {
  code?: unknown;
  message?: unknown;
  name?: unknown;
  stack?: unknown;
}): Error & { code?: string } {
  const error = new Error(
    details.message ? String(details.message) : "WebView script failed",
  ) as Error & { code?: string };

  if (details.name) error.name = String(details.name);
  if (details.code) error.code = String(details.code);
  if (details.stack) error.stack = String(details.stack);

  return error;
}
