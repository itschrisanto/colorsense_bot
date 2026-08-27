// WCAG 2.1 contrast ratio + auto-fix utilities (pure, no DOM).

export type Hex = string;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function isValidHex(hex: string): boolean {
  const t = hex.trim().replace("#", "");
  return /^[0-9a-fA-F]{3}$/.test(t) || /^[0-9a-fA-F]{6}$/.test(t);
}

export function normalizeHex(hex: string): Hex {
  let h = hex.trim().replace("#", "").toUpperCase();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return `#${h}`;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function rgbToHex(r: number, g: number, b: number): Hex {
  const toHex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

export function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexToRgb(hexA));
  const lumB = relativeLuminance(hexToRgb(hexB));
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

export type WcagVerdict = {
  ratio: number;
  ratioFormatted: string;
  aaNormal: boolean; // 4.5:1
  aaLarge: boolean;  // 3:1
  aaaNormal: boolean; // 7:1
  aaaLarge: boolean;  // 4.5:1
  bestGrade: "AAA" | "AA" | "AA Large" | "Fail";
};

export function evaluate(fg: string, bg: string): WcagVerdict {
  const ratio = contrastRatio(fg, bg);
  const aaNormal = ratio >= 4.5;
  const aaLarge = ratio >= 3;
  const aaaNormal = ratio >= 7;
  const aaaLarge = ratio >= 4.5;
  const bestGrade: WcagVerdict["bestGrade"] =
    aaaNormal ? "AAA" : aaNormal ? "AA" : aaLarge ? "AA Large" : "Fail";
  return {
    ratio,
    ratioFormatted: `${ratio.toFixed(2)}:1`,
    aaNormal,
    aaLarge,
    aaaNormal,
    aaaLarge,
    bestGrade,
  };
}

// ── HSL helpers ─────────────────────────────────────────────────────────────
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
      case gn: h = (bn - rn) / d + 2; break;
      case bn: h = (rn - gn) / d + 4; break;
    }
    h *= 60;
  }
  return [h, s, l];
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = h / 360;
  return [
    Math.round(hue2rgb(p, q, hk + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, hk) * 255),
    Math.round(hue2rgb(p, q, hk - 1 / 3) * 255),
  ];
}

// ── Auto-fix ────────────────────────────────────────────────────────────────
// Adjust the `adjust` color (preserving hue + saturation) by walking lightness
// in the direction that increases contrast vs `anchor`, until target ratio is
// met. Returns null if even pure black/white doesn't meet the target.
export function suggestFix(
  adjust: string,
  anchor: string,
  targetRatio: number,
): { hex: Hex; ratio: number; direction: "lighter" | "darker" } | null {
  const anchorLum = relativeLuminance(hexToRgb(anchor));
  const [h, s, l0] = rgbToHsl(...hexToRgb(adjust));

  const tryDirection = (dir: "lighter" | "darker") => {
    const step = 0.01;
    let l = l0;
    // 101 steps is enough to walk the full 0..1 lightness range from any start.
    for (let i = 0; i < 101; i++) {
      l = dir === "lighter" ? l + step : l - step;
      const clamped = clamp(l, 0, 1);
      const candidate = rgbToHex(...hslToRgb(h, s, clamped));
      const r = contrastRatio(candidate, anchor);
      if (r >= targetRatio) return { hex: candidate, ratio: r, direction: dir };
      if (clamped === 0 || clamped === 1) return null;
    }
    return null;
  };

  // Pick the direction that moves *away* from the anchor's luminance.
  const preferLighter = anchorLum < 0.5;
  const first = preferLighter ? "lighter" : "darker";
  const second = preferLighter ? "darker" : "lighter";
  return tryDirection(first) ?? tryDirection(second);
}
