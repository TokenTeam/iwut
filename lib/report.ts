import * as Sentry from "@sentry/react-native";

import { logger } from "@/lib/logger";
import { isNetworkError } from "@/lib/network-error";
import { useTelemetryStore } from "@/store/telemetry";

const log = logger.extend("Report");

export function reportError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  log.error(error, context);

  if (__DEV__ || !useTelemetryStore.getState().enabled || isNetworkError(error))
    return;

  Sentry.captureException(error, {
    tags: context?.module ? { module: String(context.module) } : undefined,
    extra: context,
  });
}
