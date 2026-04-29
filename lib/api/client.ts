import type { ApiRequestOptions, ApiResponse } from "./types";

function buildUrl(
  base: string,
  path: string,
  params?: Record<string, unknown>,
): string {
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  const url = new URL(normalizedPath, normalizedBase);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value == null) continue;
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, String(item));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

function buildHeaders(options?: ApiRequestOptions): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (options?.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  return headers;
}

export interface ApiClient {
  get<T>(
    path: string,
    params?: Record<string, unknown>,
    options?: ApiRequestOptions,
  ): Promise<ApiResponse<T>>;
  post<T>(
    path: string,
    body?: unknown,
    options?: ApiRequestOptions,
  ): Promise<ApiResponse<T>>;
}

function createClient(base: string): ApiClient {
  return {
    async get<T>(
      path: string,
      params?: Record<string, unknown>,
      options?: ApiRequestOptions,
    ): Promise<ApiResponse<T>> {
      const res = await fetch(buildUrl(base, path, params), {
        method: "GET",
        headers: buildHeaders(options),
        signal: options?.signal,
      });
      return res.json() as Promise<ApiResponse<T>>;
    },

    async post<T>(
      path: string,
      body?: unknown,
      options?: ApiRequestOptions,
    ): Promise<ApiResponse<T>> {
      const res = await fetch(buildUrl(base, path), {
        method: "POST",
        headers: {
          ...buildHeaders(options),
          "Content-Type": "application/json",
        },
        body: body != null ? JSON.stringify(body) : undefined,
        signal: options?.signal,
      });
      return res.json() as Promise<ApiResponse<T>>;
    },
  };
}
// 这个client的命名很重要 代码自动生成规则( /lib/api/protoc-gen-http-client.mjs )就是 sneak -> camel + 'Client'。如果你不知道啥意思就别改 
export const authCenterClient = createClient("");

export const appCenterClient = createClient("");
