import { IWUT_WEB_URL } from "@/constants/api";
import { createScanUrl, type ScanEnvelope } from "@/lib/scan";

export interface ShareArtifacts {
  qrValue: string;
  deepLink: string;
  webLink: string;
}

export function buildShareArtifacts(envelope: ScanEnvelope): ShareArtifacts {
  const deepLink = createScanUrl(envelope);

  return {
    qrValue: JSON.stringify(envelope),
    deepLink,
    webLink: `${IWUT_WEB_URL}/share?iwut=${encodeURIComponent(
      deepLink.slice("iwut://".length),
    )}`,
  };
}
