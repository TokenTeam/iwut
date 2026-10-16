import * as Sentry from "@sentry/react-native";

import { isNetworkError } from "@/lib/network-error";
import { logger } from "@/lib/logger";

const log = logger.extend("Report");

export function reportError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  log.error(error, context);

  if (__DEV__ || isNetworkError(error)) return;

  Sentry.captureException(error, {
    tags: context?.module ? { module: String(context.module) } : undefined,
    extra: context,
  });
}
