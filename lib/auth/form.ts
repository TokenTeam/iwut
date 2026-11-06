import type { TKey } from "@/lib/i18n/languages";

export type AuthMode = "login" | "register";
export type AuthValues = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};
export type AuthErrors = Partial<Record<keyof AuthValues, TKey>>;

export function validateAuthForm(
  mode: AuthMode,
  values: AuthValues,
): AuthErrors {
  const errors: AuthErrors = {};
  if (!values.email.trim()) {
    errors.email = "auth.emailRequired";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "auth.emailInvalid";
  }
  if (!values.password) errors.password = "auth.passwordRequired";

  if (mode === "register") {
    if (!values.name.trim()) errors.name = "auth.nameRequired";
    if (values.password && values.password.length < 8) {
      errors.password = "auth.passwordTooShort";
    } else if (values.password.length > 128) {
      errors.password = "auth.passwordTooLong";
    }
    if (!values.confirmPassword) {
      errors.confirmPassword = "auth.confirmPasswordRequired";
    } else if (values.password !== values.confirmPassword) {
      errors.confirmPassword = "auth.passwordMismatch";
    }
  }
  return errors;
}

export function getAuthErrorKey(error: {
  code?: string;
  status?: number;
}): TKey {
  if (error.status === 429) return "auth.rateLimited";
  switch (error.code) {
    case "INVALID_EMAIL":
      return "auth.emailInvalid";
    case "INVALID_PASSWORD":
    case "INVALID_EMAIL_OR_PASSWORD":
    case "USER_NOT_FOUND":
    case "CREDENTIAL_ACCOUNT_NOT_FOUND":
      return "auth.invalidCredentials";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "auth.emailInUse";
    case "EMAIL_NOT_VERIFIED":
      return "auth.emailNotVerified";
    case "PASSWORD_TOO_SHORT":
      return "auth.passwordTooShort";
    case "PASSWORD_TOO_LONG":
      return "auth.passwordTooLong";
    case "EMAIL_PASSWORD_SIGN_UP_DISABLED":
      return "auth.registrationDisabled";
    default:
      return "auth.requestFailed";
  }
}
