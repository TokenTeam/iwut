import { createScanUrl, type ScanEnvelope } from "@/lib/scan";

export interface ShareArtifacts {
  qrValue: string;
  deepLink: string;
}

export function buildShareArtifacts(envelope: ScanEnvelope): ShareArtifacts {
  return {
    qrValue: JSON.stringify(envelope),
    deepLink: createScanUrl(envelope),
  };
}
