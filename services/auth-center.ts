import { fetch } from "expo/fetch";

import { AUTH_CENTER_BASE_URL } from "@/constants/api";
import type { TKey } from "@/lib/i18n";

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ApiEnvelope<T> = {
  code?: number;
  message?: string;
  reason?: string;
  traceId?: string;
  data?: T;
};

export type AuthCenterTokens = {
  accessToken: string;
  refreshToken: string;
};

type RegisterData = {
  userId: string;
};

export type AuthCenterProfile = {
  userId: string;
  email: string;
  createdAt?: string;
  updatedAt?: string;
  attrs: Record<string, unknown>;
};

type ErrorKeyResolver = (code: number, reason?: string) => TKey;

export class AuthCenterError extends Error {
  constructor(
    message: string,
    readonly messageKey: TKey,
    readonly code = 0,
    readonly reason?: string,
    readonly traceId?: string,
  ) {
    super(message);
    this.name = "AuthCenterError";
  }
}

const isClientError = (code: number) => code >= 400 && code < 500;

export function authErrorKey(error: unknown, fallback: TKey): TKey {
  return error instanceof AuthCenterError ? error.messageKey : fallback;
}

async function requestAuthCenter<T>(
  path: string,
  init: RequestInit,
  errorKey: ErrorKeyResolver,
): Promise<ApiEnvelope<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(`${AUTH_CENTER_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...init.headers,
      },
      signal: controller.signal,
    });

    const responseText = await response.text();
    if (response.ok && responseText.trim() === "") {
      return {};
    }

    let payload: ApiEnvelope<T>;
    try {
      payload = JSON.parse(responseText) as ApiEnvelope<T>;
    } catch {
      throw new AuthCenterError(
        `unrecognized response (HTTP ${response.status})`,
        "account.badResponse",
        response.status,
      );
    }

    if (!response.ok || payload.code !== 200) {
      const code = payload.code ?? response.status;
      throw new AuthCenterError(
        payload.message || `request failed (HTTP ${response.status})`,
        errorKey(code, payload.reason),
        code,
        payload.reason,
        payload.traceId,
      );
    }

    return payload;
  } catch (error) {
    if (error instanceof AuthCenterError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AuthCenterError("request timeout", "account.requestTimeout");
    }
    throw new AuthCenterError("network request failed", "account.networkError");
  } finally {
    clearTimeout(timeout);
  }
}

export async function loginToAuthCenter(
  email: string,
  password: string,
): Promise<AuthCenterTokens> {
  const payload = await requestAuthCenter<AuthCenterTokens>(
    "/auth/login",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    },
    (code) =>
      isClientError(code) && code !== 429
        ? "account.invalidCredentials"
        : "account.loginFailed",
  );

  if (!payload.data?.accessToken || !payload.data.refreshToken) {
    throw new AuthCenterError("incomplete login tokens", "account.badResponse");
  }

  return payload.data;
}

export async function refreshAuthCenterTokens(
  refreshToken: string,
): Promise<AuthCenterTokens> {
  const payload = await requestAuthCenter<AuthCenterTokens>(
    "/auth/refresh-token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
    },
    () => "account.loginFailed",
  );

  if (!payload.data?.accessToken || !payload.data.refreshToken) {
    throw new AuthCenterError("incomplete login tokens", "account.badResponse");
  }

  return payload.data;
}

export async function getAuthCenterProfile(
  accessToken: string,
): Promise<AuthCenterProfile> {
  const payload = await requestAuthCenter<AuthCenterProfile>(
    "/user/profile",
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    () => "account.profileLoadFailed",
  );

  if (!payload.data?.userId || !payload.data.email) {
    throw new AuthCenterError("incomplete profile data", "account.badResponse");
  }

  return {
    ...payload.data,
    attrs:
      payload.data.attrs && typeof payload.data.attrs === "object"
        ? payload.data.attrs
        : {},
  };
}

export async function sendRegisterCode(email: string): Promise<void> {
  const query = new URLSearchParams({ email });
  await requestAuthCenter<never>(
    `/auth/get-register-mail?${query}`,
    { method: "GET" },
    (code, reason) => {
      if (reason === "CAPTCHA_REQUEST_TOO_FREQUENTLY" || code === 429) {
        return "account.captchaTooFrequent";
      }
      if (reason === "USER_ALREADY_EXISTS" || code === 409) {
        return "account.emailAlreadyRegistered";
      }
      return "account.codeSendFailed";
    },
  );
}

export async function sendResetPasswordMail(email: string): Promise<void> {
  const query = new URLSearchParams({ email });
  await requestAuthCenter<never>(
    `/auth/get-reset-url-mail?${query}`,
    { method: "GET" },
    (code, reason) => {
      if (reason === "USER_NOT_FOUND" || code === 404) {
        return "account.emailNotRegistered";
      }
      if (reason === "CAPTCHA_REQUEST_TOO_FREQUENTLY" || code === 429) {
        return "account.captchaTooFrequent";
      }
      return "account.resetMailFailed";
    },
  );
}

export async function registerAuthCenterAccount(
  email: string,
  verifyCode: string,
  password: string,
): Promise<string> {
  const payload = await requestAuthCenter<RegisterData>(
    "/auth/register",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, verifyCode, password }),
    },
    (code, reason) => {
      if (reason === "INVALID_CAPTCHA") return "account.invalidCaptcha";
      if (reason === "USER_ALREADY_EXISTS" || code === 409) {
        return "account.emailAlreadyRegistered";
      }
      return "account.registerFailed";
    },
  );

  if (!payload.data?.userId) {
    throw new AuthCenterError(
      "missing userId in response",
      "account.badResponse",
    );
  }

  return payload.data.userId;
}

export async function resetAuthCenterPassword(
  email: string,
  verifyCode: string,
  password: string,
): Promise<void> {
  await requestAuthCenter<never>(
    "/auth/reset-password",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, verifyCode, password }),
    },
    (code, reason) => {
      if (reason === "INVALID_CAPTCHA") return "account.invalidResetCode";
      if (reason === "USER_NOT_FOUND" || code === 404) {
        return "account.emailNotRegistered";
      }
      return "account.resetFailed";
    },
  );
}
