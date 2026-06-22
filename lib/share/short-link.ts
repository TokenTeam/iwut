import type { ScanEnvelope } from "@/lib/scan";

export const SHORT_LINK_ENABLED = false;

export async function resolveShortLink(
  _envelope: ScanEnvelope,
): Promise<string | null> {
  if (!SHORT_LINK_ENABLED) return null;
  return null;
}
