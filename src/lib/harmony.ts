/**
 * Color-wheel harmony math — ported verbatim from
 * artifacts/color-palette/src/components/lab/panels/SchemePanel.tsx, which
 * powers the website's "Color Scheme Generator" tool. Pure HSL hue-rotation
 * math, no AI call — a different, free feature from the paid /color/harmonies
 * (Gemini) endpoint, which stays out of scope.
 */

export type Harmony =
  | "complementary"
  | "monochromatic"
  | "analogous"
  | "split-complementary"
  | "triadic"
  | "tetradic";

export const HARMONY_LABELS: Record<Harmony, string> = {
  complementary: "Complementary",
  monochromatic: "Monochromatic",
  analogous: "Analogous",
  "split-complementary": "Split-comp.",
  triadic: "Triadic",
  tetradic: "Tetradic",
};

function hexToHsl(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let s = 0, hh = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: hh = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: hh = ((b - r) / d + 2); break;
      case b: hh = ((r - g) / d + 4); break;
    }
    hh *= 60;
  }
  return [hh, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

export function getHarmonyColors(baseHex: string, harmony: Harmony): string[] {
  const [h, s, l] = hexToHsl(baseHex);
  switch (harmony) {
    case "complementary":
      return [baseHex.toUpperCase(), hslToHex(h + 180, s, l)];
    case "monochromatic": {
      const ls = [Math.max(0.15, l - 0.3), Math.max(0.25, l - 0.15), l, Math.min(0.75, l + 0.15), Math.min(0.9, l + 0.3)];
      return ls.map((li) => hslToHex(h, s, li));
    }
    case "analogous":
      return [hslToHex(h - 30, s, l), baseHex.toUpperCase(), hslToHex(h + 30, s, l)];
    case "split-complementary":
      return [baseHex.toUpperCase(), hslToHex(h + 150, s, l), hslToHex(h + 210, s, l)];
    case "triadic":
      return [baseHex.toUpperCase(), hslToHex(h + 120, s, l), hslToHex(h + 240, s, l)];
    case "tetradic":
      return [baseHex.toUpperCase(), hslToHex(h + 90, s, l), hslToHex(h + 180, s, l), hslToHex(h + 270, s, l)];
  }
}
