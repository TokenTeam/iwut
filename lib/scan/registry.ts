import { parseScanText } from "./protocol";
import { courseSingleScanAction } from "./actions/course-single";
import { schedulePaletteScanAction } from "./actions/schedule-palette";
import type {
  ResolvedScanAction,
  ScanActionContext,
  ScanActionHandler,
} from "./types";

const defaultHandlers: ScanActionHandler[] = [
  schedulePaletteScanAction,
  courseSingleScanAction,
];
const extraHandlers: ScanActionHandler[] = [];

export function registerScanActionHandler(handler: ScanActionHandler): void {
  const exists = [...defaultHandlers, ...extraHandlers].some(
    (item) => item.id === handler.id,
  );
  if (!exists) extraHandlers.push(handler);
}

export function getScanActionHandlers(): ScanActionHandler[] {
  return [...defaultHandlers, ...extraHandlers];
}

export function resolveScanAction(
  raw: string,
  context: ScanActionContext,
): ResolvedScanAction {
  const parsed = parseScanText(raw);
  if (!parsed.ok) {
    return {
      status: "invalid",
      raw: parsed.raw,
      reason: parsed.reason,
    };
  }

  const handler = getScanActionHandlers().find((item) =>
    item.canHandle(parsed.envelope),
  );
  if (!handler) {
    return {
      status: "invalid",
      raw: parsed.raw,
      reason: "noHandler",
    };
  }

  const preview = handler.getPreview(parsed.envelope, context);
  if (!preview) {
    return {
      status: "invalid",
      raw: parsed.raw,
      reason: "previewRejected",
    };
  }

  return {
    status: "matched",
    raw: parsed.raw,
    envelope: parsed.envelope,
    preview,
    handler,
  };
}
