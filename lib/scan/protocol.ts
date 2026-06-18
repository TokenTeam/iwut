export const IWUT_SCAN_APP = "iwut";
export const IWUT_SCAN_VERSION = 1;
export const IWUT_SCAN_URL = "iwut://scan";

const MAX_SCAN_TEXT_LENGTH = 12000;

// Stay well under the ~2331-byte QR ceiling so codes scan reliably on phones.
export const QR_SAFE_BYTE_LIMIT = 1800;

export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i++;
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

export interface ScanEnvelope<TPayload = unknown> {
  app: typeof IWUT_SCAN_APP;
  version: typeof IWUT_SCAN_VERSION;
  action: string;
  type: string;
  payload: TPayload;
  meta?: {
    title?: string;
    createdAt?: string;
  };
}

export type ScanParseError = "empty" | "tooLarge" | "malformed" | "unsupported";

export type ScanParseResult =
  | {
      ok: true;
      raw: string;
      envelope: ScanEnvelope;
    }
  | {
      ok: false;
      raw: string;
      reason: ScanParseError;
    };

export function createScanUrl(envelope: ScanEnvelope): string {
  return `${IWUT_SCAN_URL}?data=${encodeURIComponent(
    JSON.stringify(envelope),
  )}`;
}

export function parseScanText(rawText: string): ScanParseResult {
  const raw = rawText.trim();
  if (!raw) return { ok: false, raw, reason: "empty" };
  if (raw.length > MAX_SCAN_TEXT_LENGTH) {
    return { ok: false, raw, reason: "tooLarge" };
  }

  const payloadText = extractEnvelopeText(raw);
  if (!payloadText) return { ok: false, raw, reason: "unsupported" };

  try {
    const data = JSON.parse(payloadText);
    if (!isScanEnvelope(data)) {
      return { ok: false, raw, reason: "malformed" };
    }
    return { ok: true, raw, envelope: data };
  } catch {
    return { ok: false, raw, reason: "malformed" };
  }
}

function extractEnvelopeText(raw: string): string | null {
  if (raw.startsWith("{")) return raw;

  try {
    const url = new URL(raw);
    const isIwutScan =
      url.protocol === "iwut:" &&
      (url.hostname === "scan" || url.hostname === "import");
    const isWebScan =
      (url.protocol === "https:" || url.protocol === "http:") &&
      url.pathname.replace(/\/+$/, "") === "/scan";

    if (!isIwutScan && !isWebScan) return null;
    return url.searchParams.get("data");
  } catch {
    return null;
  }
}

function isScanEnvelope(data: unknown): data is ScanEnvelope {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    obj.app === IWUT_SCAN_APP &&
    obj.version === IWUT_SCAN_VERSION &&
    typeof obj.action === "string" &&
    obj.action.length > 0 &&
    typeof obj.type === "string" &&
    obj.type.length > 0 &&
    "payload" in obj
  );
}
