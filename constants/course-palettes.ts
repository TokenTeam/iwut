import type { TKey } from "@/lib/i18n";

export interface ColorPalette {
  name: string;
  version: 1;
  colors: string[];
  overrides?: Record<string, string>;
}

// Maps the persisted Chinese palette name back to an i18n key so we can
// localize built-in palette names at render time without changing the
// stored schema (legacy MMKV state and exported JSON keep working).
export const BUILTIN_PALETTE_NAME_KEYS: Record<string, TKey> = {
  默认: "palettes.default",
  马卡龙: "palettes.macaron",
  森林: "palettes.forest",
  星空: "palettes.starry",
  日落: "palettes.sunset",
  海洋: "palettes.ocean",
  樱花: "palettes.sakura",
  薄荷: "palettes.mint",
  莫兰迪: "palettes.morandi",
  霓虹: "palettes.neon",
};

export const BUILTIN_PALETTES: ColorPalette[] = [
  {
    name: "默认",
    version: 1,
    colors: [
      "rgba(91,155,213,0.75)",
      "rgba(112,173,71,0.75)",
      "rgba(237,125,49,0.75)",
      "rgba(168,85,247,0.75)",
      "rgba(236,72,153,0.75)",
      "rgba(20,184,166,0.75)",
      "rgba(245,158,11,0.75)",
      "rgba(99,102,241,0.75)",
    ],
  },
  {
    name: "马卡龙",
    version: 1,
    colors: [
      "rgba(219,112,147,0.80)",
      "rgba(137,120,195,0.80)",
      "rgba(100,160,210,0.80)",
      "rgba(72,191,163,0.80)",
      "rgba(228,148,96,0.80)",
      "rgba(175,122,197,0.80)",
      "rgba(130,178,121,0.80)",
      "rgba(215,125,125,0.80)",
    ],
  },
  {
    name: "森林",
    version: 1,
    colors: [
      "rgba(56,142,96,0.80)",
      "rgba(140,155,66,0.80)",
      "rgba(165,120,78,0.80)",
      "rgba(82,145,110,0.80)",
      "rgba(60,130,118,0.80)",
      "rgba(148,108,68,0.80)",
      "rgba(95,160,82,0.80)",
      "rgba(180,140,55,0.80)",
    ],
  },
  {
    name: "星空",
    version: 1,
    colors: [
      "rgba(55,75,155,0.85)",
      "rgba(88,68,168,0.85)",
      "rgba(110,62,148,0.85)",
      "rgba(62,98,178,0.85)",
      "rgba(95,55,140,0.85)",
      "rgba(155,75,130,0.85)",
      "rgba(72,108,158,0.85)",
      "rgba(68,62,132,0.85)",
    ],
  },
  {
    name: "日落",
    version: 1,
    colors: [
      "rgba(230,118,50,0.80)",
      "rgba(215,95,82,0.80)",
      "rgba(205,75,120,0.80)",
      "rgba(218,150,42,0.80)",
      "rgba(222,128,88,0.80)",
      "rgba(195,68,132,0.80)",
      "rgba(238,135,58,0.80)",
      "rgba(188,60,102,0.80)",
    ],
  },
  {
    name: "海洋",
    version: 1,
    colors: [
      "rgba(30,120,180,0.80)",
      "rgba(0,150,160,0.80)",
      "rgba(60,90,165,0.80)",
      "rgba(25,170,140,0.80)",
      "rgba(70,130,195,0.80)",
      "rgba(40,155,110,0.80)",
      "rgba(85,105,185,0.80)",
      "rgba(20,140,170,0.80)",
    ],
  },
  {
    name: "樱花",
    version: 1,
    colors: [
      "rgba(210,90,130,0.78)",
      "rgba(180,100,155,0.78)",
      "rgba(225,120,110,0.78)",
      "rgba(195,80,145,0.78)",
      "rgba(165,110,165,0.78)",
      "rgba(215,105,95,0.78)",
      "rgba(190,90,120,0.78)",
      "rgba(175,115,140,0.78)",
    ],
  },
  {
    name: "薄荷",
    version: 1,
    colors: [
      "rgba(45,175,145,0.78)",
      "rgba(80,155,120,0.78)",
      "rgba(55,160,170,0.78)",
      "rgba(100,180,130,0.78)",
      "rgba(35,150,155,0.78)",
      "rgba(70,170,110,0.78)",
      "rgba(50,140,165,0.78)",
      "rgba(90,165,140,0.78)",
    ],
  },
  {
    name: "莫兰迪",
    version: 1,
    colors: [
      "rgba(155,120,130,0.82)",
      "rgba(120,135,150,0.82)",
      "rgba(145,130,110,0.82)",
      "rgba(130,120,145,0.82)",
      "rgba(140,140,120,0.82)",
      "rgba(125,130,140,0.82)",
      "rgba(150,115,120,0.82)",
      "rgba(115,140,130,0.82)",
    ],
  },
  {
    name: "霓虹",
    version: 1,
    colors: [
      "rgba(230,60,80,0.78)",
      "rgba(67,99,216,0.78)",
      "rgba(60,180,75,0.78)",
      "rgba(200,60,200,0.78)",
      "rgba(240,130,40,0.78)",
      "rgba(0,175,200,0.78)",
      "rgba(180,65,150,0.78)",
      "rgba(220,180,30,0.78)",
    ],
  },
];

export function validateColorPalette(data: unknown): data is ColorPalette {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj.name !== "string" || !obj.name) return false;
  if (obj.version !== 1) return false;
  if (!Array.isArray(obj.colors) || obj.colors.length === 0) return false;
  if (!obj.colors.every((c: unknown) => typeof c === "string")) return false;
  if (
    obj.overrides !== undefined &&
    (typeof obj.overrides !== "object" || obj.overrides === null)
  )
    return false;
  return true;
}
