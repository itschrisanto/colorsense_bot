// Color-blindness simulation using the Machado 2009 model. Ported verbatim
// from artifacts/color-palette/src/lib/colorBlind.ts, which powers the
// website's Palette Health tool. Matrices are applied in LINEAR sRGB (the
// space the model is defined in), then converted back to gamma-encoded
// sRGB. Severity = 1.0 (full dichromacy).
import { hexToRgb, rgbToHex } from "./wcagContrast.js";

export type CbType = "deuteranopia" | "protanopia" | "tritanopia";

export const CB_LABELS: Record<CbType, { label: string; prevalence: string }> = {
  deuteranopia: { label: "Deuteranopia", prevalence: "~6% of men" },
  protanopia: { label: "Protanopia", prevalence: "~2% of men" },
  tritanopia: { label: "Tritanopia", prevalence: "rare" },
};

// Machado et al. (2009) transformation matrices, severity 1.0.
const MACHADO: Record<CbType, number[][]> = {
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

function toLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function toSrgb(c: number): number {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, v)) * 255);
}

/** Simulate how a single hex color appears under the given color-blindness type. */
export function simulateHex(hex: string, type: CbType): string {
  const [r0, g0, b0] = hexToRgb(hex);
  const r = toLinear(r0);
  const g = toLinear(g0);
  const b = toLinear(b0);
  const m = MACHADO[type]!;
  const R = m[0]![0]! * r + m[0]![1]! * g + m[0]![2]! * b;
  const G = m[1]![0]! * r + m[1]![1]! * g + m[1]![2]! * b;
  const B = m[2]![0]! * r + m[2]![1]! * g + m[2]![2]! * b;
  return rgbToHex(toSrgb(R), toSrgb(G), toSrgb(B));
}

/** Simulate a whole palette. */
export function simulatePalette(hexes: string[], type: CbType): string[] {
  return hexes.map((h) => simulateHex(h, type));
}

// ── Confusable-pair detection (Lab ΔE on the simulated colors) ────────────────
function rgbToLab([r, g, b]: [number, number, number]): [number, number, number] {
  const f = (c: number) => {
    const s = c / 255;
    return (s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)) * 100;
  };
  const R = f(r);
  const G = f(g);
  const B = f(b);
  let X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 95.047;
  let Y = (R * 0.2126 + G * 0.7152 + B * 0.0722) / 100;
  let Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 108.883;
  const g2 = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  X = g2(X);
  Y = g2(Y);
  Z = g2(Z);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}

function deltaE(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

export type ConfusablePair = { i: number; j: number; deltaE: number };

/**
 * Find pairs of palette colors that become hard to tell apart under the given
 * color-blindness type. ΔE < threshold (default ~14, "easily confused") flags it.
 */
export function confusablePairs(hexes: string[], type: CbType, threshold = 14): ConfusablePair[] {
  const labs = simulatePalette(hexes, type).map((s) => rgbToLab(hexToRgb(s)));
  const out: ConfusablePair[] = [];
  for (let i = 0; i < labs.length; i++) {
    for (let j = i + 1; j < labs.length; j++) {
      const d = deltaE(labs[i]!, labs[j]!);
      if (d < threshold) out.push({ i, j, deltaE: d });
    }
  }
  return out.sort((a, b) => a.deltaE - b.deltaE);
}
