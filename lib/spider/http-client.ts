import { fetchNoRedirect } from "@/lib/fetch";

import { SpiderException } from "./error";
import type {
  EngineOptions,
  SpiderHttpClient,
  SpiderHttpClientProvider,
  SpiderHttpClientResponse,
  SpiderPayloadType,
} from "./types";

const DEFAULT_SUCCESS_CODE = 200;
const REDIRECT_CODES = new Set([301, 302]);
const MAX_REDIRECTS = 10;
const SPIDER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0";

type StoredCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  expiresAt?: number;
  hostOnly: boolean;
};

export class SpiderHttpClientImpl implements SpiderHttpClient {
  private readonly cookieJar: InMemoryCookieJar | null;

  constructor(private readonly options: EngineOptions) {
    this.cookieJar = options.cookie ? new InMemoryCookieJar() : null;
  }

  async get(
    url: string,
    headers: Record<string, string>,
    success = DEFAULT_SUCCESS_CODE,
    autoRedirect = false,
  ): Promise<SpiderHttpClientResponse> {
    return this.makeRequest(
      {
        url,
        method: "GET",
        headers,
      },
      success,
      autoRedirect,
    );
  }

  async post(
    url: string,
    headers: Record<string, string>,
    payload: string,
    payloadType: SpiderPayloadType,
    success = DEFAULT_SUCCESS_CODE,
    autoRedirect = false,
  ): Promise<SpiderHttpClientResponse> {
    const contentType =
      payloadType === "json"
        ? "application/json"
        : payloadType === "form"
          ? "application/x-www-form-urlencoded"
          : "application/text";

    return this.makeRequest(
      {
        url,
        method: "POST",
        headers: withHeaderIfMissing(headers, "Content-Type", contentType),
        body: payload,
      },
      success,
      autoRedirect,
    );
  }

  private async makeRequest(
    request: SpiderRequest,
    success: number,
    allowRedirect: boolean,
  ): Promise<SpiderHttpClientResponse> {
    let currentRequest = request;

    try {
      for (
        let redirectCount = 0;
        redirectCount <= MAX_REDIRECTS;
        redirectCount += 1
      ) {
        const response = await fetchNoRedirect(currentRequest.url, {
          method: currentRequest.method,
          headers: this.buildRequestHeaders(currentRequest),
          body: currentRequest.body,
          tlsCheckValidity: !this.options.forceSSL,
        });

        const headerEntries = Array.from(response.headers);
        if (this.cookieJar) {
          this.cookieJar.storeFromResponse(currentRequest.url, headerEntries);
        }

        if (allowRedirect && REDIRECT_CODES.has(response.status)) {
          const location = findHeader(headerEntries, "location");
          if (!location) {
            throw new SpiderException(
              `Redirect response from ${currentRequest.url} did not include Location header`,
            );
          }

          currentRequest = {
            url: new URL(location, currentRequest.url).toString(),
            method: "GET",
            headers: {},
          };
          continue;
        }

        if (response.status !== success) {
          throw new SpiderException(
            `Unexpected status code while requesting ${currentRequest.url}. ` +
              `actual: ${response.status}, expected: ${success}`,
          );
        }

        return {
          statusCode: response.status,
          headers: normalizeResponseHeaders(headerEntries),
          content: await response.text(),
        };
      }

      throw new SpiderException(
        `Too many redirects while requesting ${request.url}`,
      );
    } catch (error) {
      if (error instanceof SpiderException) {
        throw error;
      }

      throw new SpiderException(`Failed to request url ${request.url}`, error);
    }
  }

  private buildRequestHeaders(request: SpiderRequest): Record<string, string> {
    const headers = withHeaderIfMissing(
      request.headers,
      "User-Agent",
      SPIDER_USER_AGENT,
    );

    if (!this.cookieJar) {
      return headers;
    }

    const cookieHeader = this.cookieJar.getCookieHeader(request.url);
    if (!cookieHeader) {
      return headers;
    }

    return {
      ...headers,
      [findHeaderName(headers, "Cookie") ?? "Cookie"]: existingHeaderValue(
        headers,
        "Cookie",
      )
        ? `${existingHeaderValue(headers, "Cookie")}; ${cookieHeader}`
        : cookieHeader,
    };
  }
}

export const DefaultSpiderHttpClientProvider: SpiderHttpClientProvider = {
  create(options: EngineOptions) {
    return new SpiderHttpClientImpl(options);
  },
};

type SpiderRequest = {
  url: string;
  method: "GET" | "POST";
  headers: Record<string, string>;
  body?: string;
};

class InMemoryCookieJar {
  private readonly cookieStore = new Map<string, StoredCookie[]>();

  storeFromResponse(url: string, headerEntries: [string, string][]): void {
    const normalizedUrl = new URL(url);
    const setCookieHeaders = headerEntries.filter(
      ([name]) => name.toLowerCase() === "set-cookie",
    );

    if (setCookieHeaders.length === 0) {
      return;
    }

    for (const [, cookieText] of setCookieHeaders) {
      const cookie = parseSetCookie(cookieText, normalizedUrl);
      const key = cookie.domain;
      const existing = this.cookieStore.get(key) ?? [];
      const next = existing.filter(
        (item) => !(item.name === cookie.name && item.path === cookie.path),
      );
      if (!isExpired(cookie)) {
        next.push(cookie);
      }
      this.cookieStore.set(key, next);
    }
  }

  getCookieHeader(url: string): string {
    const normalizedUrl = new URL(url);
    const cookies: StoredCookie[] = [];

    for (const [domain, storedCookies] of this.cookieStore.entries()) {
      if (!domainMatches(normalizedUrl.hostname, domain)) {
        continue;
      }

      const validCookies = storedCookies.filter(
        (cookie) =>
          !isExpired(cookie) &&
          pathMatches(normalizedUrl.pathname, cookie.path) &&
          (!cookie.secure || normalizedUrl.protocol === "https:") &&
          (cookie.hostOnly ? normalizedUrl.hostname === cookie.domain : true),
      );

      if (validCookies.length > 0) {
        this.cookieStore.set(domain, validCookies);
        cookies.push(...validCookies);
      }
    }

    return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
  }
}

function parseSetCookie(value: string, url: URL): StoredCookie {
  const segments = value.split(";").map((segment) => segment.trim());
  const [nameValue, ...attributeSegments] = segments;
  const separatorIndex = nameValue.indexOf("=");

  if (separatorIndex === -1) {
    throw new SpiderException(`Invalid Set-Cookie header: ${value}`);
  }

  const cookie: StoredCookie = {
    name: nameValue.slice(0, separatorIndex).trim(),
    value: nameValue.slice(separatorIndex + 1).trim(),
    domain: url.hostname,
    path: defaultCookiePath(url.pathname),
    secure: false,
    hostOnly: true,
  };

  for (const attribute of attributeSegments) {
    const [rawName, ...rest] = attribute.split("=");
    const name = rawName.trim().toLowerCase();
    const attrValue = rest.join("=").trim();

    if (name === "domain" && attrValue) {
      cookie.domain = attrValue.replace(/^\./, "").toLowerCase();
      cookie.hostOnly = false;
    } else if (name === "path" && attrValue) {
      cookie.path = attrValue;
    } else if (name === "secure") {
      cookie.secure = true;
    } else if (name === "max-age") {
      const seconds = Number.parseInt(attrValue, 10);
      if (!Number.isNaN(seconds)) {
        cookie.expiresAt = Date.now() + seconds * 1000;
      }
    } else if (name === "expires") {
      const expiresAt = Date.parse(attrValue);
      if (!Number.isNaN(expiresAt)) {
        cookie.expiresAt = expiresAt;
      }
    }
  }

  return cookie;
}

function normalizeResponseHeaders(
  headers: [string, string][],
): Record<string, string> {
  const merged = new Map<string, string[]>();

  for (const [name, value] of headers) {
    const key = name.toLowerCase();
    const current = merged.get(key);
    if (current) {
      current.push(value);
    } else {
      merged.set(key, [value]);
    }
  }

  return Object.fromEntries(
    Array.from(merged.entries(), ([name, values]) => [name, values.join(";")]),
  );
}

function findHeader(
  headers: [string, string][],
  name: string,
): string | undefined {
  const loweredName = name.toLowerCase();
  const match = headers.find(
    ([headerName]) => headerName.toLowerCase() === loweredName,
  );
  return match?.[1];
}

function withHeaderIfMissing(
  headers: Record<string, string>,
  name: string,
  value: string,
): Record<string, string> {
  if (findHeaderName(headers, name)) {
    return { ...headers };
  }

  return {
    ...headers,
    [name]: value,
  };
}

function existingHeaderValue(
  headers: Record<string, string>,
  name: string,
): string | undefined {
  const actualName = findHeaderName(headers, name);
  return actualName ? headers[actualName] : undefined;
}

function findHeaderName(
  headers: Record<string, string>,
  name: string,
): string | undefined {
  const loweredName = name.toLowerCase();
  return Object.keys(headers).find(
    (headerName) => headerName.toLowerCase() === loweredName,
  );
}

function defaultCookiePath(pathname: string): string {
  if (!pathname || !pathname.startsWith("/")) {
    return "/";
  }
  if (pathname === "/") {
    return "/";
  }

  const lastSlashIndex = pathname.lastIndexOf("/");
  return lastSlashIndex <= 0 ? "/" : pathname.slice(0, lastSlashIndex);
}

function domainMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function pathMatches(pathname: string, cookiePath: string): boolean {
  if (cookiePath === "/") {
    return pathname.startsWith("/");
  }

  return pathname === cookiePath || pathname.startsWith(`${cookiePath}/`);
}

function isExpired(cookie: StoredCookie): boolean {
  return cookie.expiresAt !== undefined && cookie.expiresAt <= Date.now();
}
