import type { t } from "@/lib/i18n";

import type { ScanEnvelope, ScanParseError } from "./protocol";

export interface ScanActionDetail {
  label: string;
  value: string;
}

export interface ScanActionPreview {
  title: string;
  description: string;
  confirmText: string;
  details?: ScanActionDetail[];
}

export interface ScanActionContext {
  t: typeof t;
}

export interface ScanExecuteResult {
  title: string;
  description?: string;
}

export interface ScanActionHandler {
  id: string;
  canHandle: (envelope: ScanEnvelope) => boolean;
  getPreview: (
    envelope: ScanEnvelope,
    context: ScanActionContext,
  ) => ScanActionPreview | null;
  execute: (
    envelope: ScanEnvelope,
    context: ScanActionContext,
  ) => Promise<ScanExecuteResult>;
}

export type ResolvedScanAction =
  | {
      status: "matched";
      raw: string;
      envelope: ScanEnvelope;
      preview: ScanActionPreview;
      handler: ScanActionHandler;
    }
  | {
      status: "invalid";
      raw: string;
      reason: ScanParseError | "noHandler" | "previewRejected";
    };
