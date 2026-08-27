// Naive RGB→CMYK conversion for soft-proofing estimates only. Real print
// output depends on the press, paper, and ICC profile — always pull a proof.
// Ported verbatim from artifacts/color-palette/src/lib/cmyk.ts.
import { hexToRgb } from "./wcagContrast.js";

export type Cmyk = { c: number; m: number; y: number; k: number };

export function hexToCmyk(hex: string): Cmyk {
  const [r0, g0, b0] = hexToRgb(hex);
  const r = r0 / 255;
  const g = g0 / 255;
  const b = b0 / 255;
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: Math.round(((1 - r - k) / (1 - k)) * 100),
    m: Math.round(((1 - g - k) / (1 - k)) * 100),
    y: Math.round(((1 - b - k) / (1 - k)) * 100),
    k: Math.round(k * 100),
  };
}

export function cmykString(hex: string): string {
  const { c, m, y, k } = hexToCmyk(hex);
  return `${c} / ${m} / ${y} / ${k}`;
}

/**
 * Heuristic: very vivid, bright colors (high saturation + high value) sit near
 * the edge of the sRGB gamut and commonly shift when converted to CMYK.
 * This is guidance, not a measurement.
 */
export function mayShiftInPrint(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const v = max;
  const s = max === 0 ? 0 : (max - min) / max;
  return s > 0.7 && v > 0.7;
}
