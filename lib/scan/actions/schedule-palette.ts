import {
  BUILTIN_PALETTE_NAME_KEYS,
  type ColorPalette,
  validateColorPalette,
} from "@/constants/course-palettes";
import { useScheduleStore } from "@/store/schedule";

import type { ScanEnvelope } from "../protocol";
import type {
  ScanActionContext,
  ScanActionHandler,
  ScanExecuteResult,
} from "../types";

export const SCHEDULE_PALETTE_SCAN_TYPE = "schedule.palette";

export function buildSchedulePaletteScanEnvelope(
  palette: ColorPalette,
): ScanEnvelope<ColorPalette> {
  return {
    app: "iwut",
    version: 1,
    action: "import",
    type: SCHEDULE_PALETTE_SCAN_TYPE,
    payload: palette,
  };
}

export function buildShareableSchedulePalette(
  palette: ColorPalette,
  courseColorOverrides: Record<string, string>,
): ColorPalette {
  const overrides = {
    ...(palette.overrides ?? {}),
    ...courseColorOverrides,
  };
  const exported: ColorPalette = { ...palette };
  if (Object.keys(overrides).length > 0) {
    exported.overrides = overrides;
  } else {
    delete exported.overrides;
  }
  return exported;
}

export const schedulePaletteScanAction: ScanActionHandler = {
  id: SCHEDULE_PALETTE_SCAN_TYPE,
  canHandle: (envelope) =>
    envelope.action === "import" &&
    envelope.type === SCHEDULE_PALETTE_SCAN_TYPE,
  getPreview: (envelope, context) => {
    const palette = getPalettePayload(envelope);
    if (!palette) return null;
    const overrideCount = Object.keys(palette.overrides ?? {}).length;
    return {
      title: context.t("scan.palettePreviewTitle"),
      description: context.t("scan.palettePreviewDesc", {
        name: getPaletteDisplayName(palette, context),
      }),
      confirmText: context.t("scan.importPalette"),
      details: [
        {
          label: context.t("scan.detailName"),
          value: getPaletteDisplayName(palette, context),
        },
        {
          label: context.t("scan.detailColors"),
          value: context.t("scan.colorsCount", {
            n: palette.colors.length,
          }),
        },
        {
          label: context.t("scan.detailOverrides"),
          value: context.t("scan.overridesCount", {
            n: overrideCount,
          }),
        },
      ],
    };
  },
  execute: async (envelope, context): Promise<ScanExecuteResult> => {
    const palette = getPalettePayload(envelope);
    if (!palette) throw new Error("Invalid palette payload");

    const store = useScheduleStore.getState();
    store.addCustomPalette(palette);
    store.setColorPalette(palette);

    return {
      title: context.t("scan.paletteImported", {
        name: getPaletteDisplayName(palette, context),
      }),
    };
  },
};

function getPalettePayload(envelope: ScanEnvelope): ColorPalette | null {
  return validateColorPalette(envelope.payload) ? envelope.payload : null;
}

function getPaletteDisplayName(
  palette: ColorPalette,
  context: ScanActionContext,
): string {
  const key = BUILTIN_PALETTE_NAME_KEYS[palette.name];
  return key ? context.t(key) : palette.name;
}
