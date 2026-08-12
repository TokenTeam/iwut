import { IWUT_WEB_URL } from "@/constants/api";
import { createShareUrl, type ScanEnvelope } from "@/lib/scan";

export interface ShareArtifacts {
  qrValue: string;
  webLink: string;
}

export function buildShareArtifacts(envelope: ScanEnvelope): ShareArtifacts {
  const deepLink = createShareUrl(envelope);

  return {
    qrValue: JSON.stringify(envelope),
    webLink: `${IWUT_WEB_URL}/share?iwut=${encodeURIComponent(
      deepLink.slice("iwut://".length),
    )}`,
  };
}
