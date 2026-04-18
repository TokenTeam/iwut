import * as Sentry from "@sentry/react-native";

export function reportError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (__DEV__) return;
  Sentry.captureException(error, {
    tags: context?.module ? { module: String(context.module) } : undefined,
    extra: context,
  });
}
