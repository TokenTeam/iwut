import * as Sentry from "@sentry/react-native";

import { isNetworkError } from "@/lib/network-error";

export function reportError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  console.error(error, context);

  if (__DEV__ || isNetworkError(error)) return;

  Sentry.captureException(error, {
    tags: context?.module ? { module: String(context.module) } : undefined,
    extra: context,
  });
}
