/**
 * Palette health scoring — ported verbatim from
 * artifacts/color-palette/src/lib/paletteHealth.ts, which powers the
 * website's Palette Health tool. Pure math (contrast, harmony, balance,
 * vibrancy, completeness), no AI call, self-contained.
 */
import { hexToRgb, rgbToHsl, relativeLuminance } from "./wcagContrast.js";

export type HealthDimension = {
  label: string;
  score: number;
  detail: string;
  tip: string;
};

export type PaletteHealthResult = {
  contrast: HealthDimension;
  harmony: HealthDimension;
  balance: HealthDimension;
  vibrancy: HealthDimension;
  completeness: HealthDimension;
  overall: number;
  grade: "A" | "B" | "C" | "D" | "F";
};

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function gradeFromScore(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

export function scorePalette(hexColors: string[]): PaletteHealthResult {
  if (hexColors.length < 2) {
    const empty: HealthDimension = { label: "", score: 0, detail: "Not enough colors", tip: "" };
    return { contrast: empty, harmony: empty, balance: empty, vibrancy: empty, completeness: empty, overall: 0, grade: "F" };
  }

  const rgbs = hexColors.map(hexToRgb);
  const hsls = rgbs.map(([r, g, b]) => rgbToHsl(r, g, b));
  const lums = rgbs.map(relativeLuminance);

  // ── Contrast ────────────────────────────────────────────────────────────────
  let maxContrast = 0;
  let passAA = 0;
  let totalPairs = 0;
  for (let i = 0; i < lums.length; i++) {
    for (let j = i + 1; j < lums.length; j++) {
      const ratio = contrastRatio(lums[i]!, lums[j]!);
      if (ratio > maxContrast) maxContrast = ratio;
      if (ratio >= 4.5) passAA++;
      totalPairs++;
    }
  }
  const aaRate = passAA / totalPairs;
  let contrastScore = 0;
  if (maxContrast >= 7) contrastScore = 90 + Math.min(10, aaRate * 10);
  else if (maxContrast >= 4.5) contrastScore = 70 + (maxContrast - 4.5) / 2.5 * 20;
  else if (maxContrast >= 3) contrastScore = 45 + (maxContrast - 3) / 1.5 * 25;
  else contrastScore = 10 + (maxContrast - 1) / 2 * 35;
  contrastScore = Math.round(Math.min(100, Math.max(0, contrastScore)));
  const contrastDetail = `Max contrast: ${maxContrast.toFixed(1)}:1 · ${passAA}/${totalPairs} pairs pass WCAG AA`;
  const contrastTip = maxContrast < 4.5
    ? "Add a very light or very dark color to create usable text/background pairs."
    : maxContrast < 7
    ? "Good contrast! Add a near-black or near-white to reach AAA for small text."
    : "Excellent contrast — palette has strong text/background options.";

  // ── Harmony ─────────────────────────────────────────────────────────────────
  const chromatic = hsls.filter(([, s]) => s > 0.12);
  let harmonyScore = 0;
  let harmonyDetail = "";
  let harmonyTip = "";
  if (chromatic.length <= 1) {
    harmonyScore = 82;
    harmonyDetail = "Monochromatic palette — single hue family";
    harmonyTip = "Monochromatic palettes are elegant. Add a subtle accent hue for more depth.";
  } else {
    const hues = chromatic.map(([h]) => h).sort((a, b) => a - b);
    let maxGap = 0;
    for (let i = 1; i < hues.length; i++) maxGap = Math.max(maxGap, hues[i]! - hues[i - 1]!);
    maxGap = Math.max(maxGap, 360 - hues[hues.length - 1]! + hues[0]!);
    const span = 360 - maxGap;

    if (span < 45) { harmonyScore = 88; harmonyDetail = "Analogous — hues are close and cohesive"; harmonyTip = "Great cohesion! The colors feel unified and natural together."; }
    else if (span >= 150 && span <= 210) { harmonyScore = 95; harmonyDetail = "Complementary — opposite hues create strong contrast"; harmonyTip = "Complementary palettes are vibrant and high-impact. Well done."; }
    else if (span >= 100 && span < 150) { harmonyScore = 80; harmonyDetail = "Split-complementary — balanced tension"; harmonyTip = "Good balance. Try nudging hues slightly for a more classic split-complementary."; }
    else if (span >= 210 && span <= 270) { harmonyScore = 88; harmonyDetail = "Triadic — three evenly spaced hues"; harmonyTip = "Triadic palettes are dynamic and balanced. Looks intentional."; }
    else { harmonyScore = 58; harmonyDetail = `Hue spread: ${Math.round(span)}° — may feel unintentional`; harmonyTip = "Try shifting colors toward analogous (<60° span) or complementary (~180°) for clearer harmony."; }
  }
  harmonyScore = Math.round(harmonyScore);

  // ── Balance ──────────────────────────────────────────────────────────────────
  const lightnesses = hsls.map(([, , l]) => l);
  const hasLight = lightnesses.some((l) => l >= 0.7);
  const hasDark = lightnesses.some((l) => l <= 0.3);
  const hasMid = lightnesses.some((l) => l > 0.3 && l < 0.7);
  const spread = Math.max(...lightnesses) - Math.min(...lightnesses);
  let balanceScore = 0;
  if (hasLight) balanceScore += 30;
  if (hasDark) balanceScore += 30;
  if (hasMid) balanceScore += 25;
  if (spread >= 0.5) balanceScore += 15;
  else if (spread >= 0.3) balanceScore += 8;
  balanceScore = Math.round(Math.min(100, balanceScore));
  const balanceDetail = `Lightness range: ${Math.round(Math.min(...lightnesses) * 100)}%–${Math.round(Math.max(...lightnesses) * 100)}%`;
  const balanceTip = !hasLight
    ? "Add a near-white or very light color to give the palette breathing room."
    : !hasDark
    ? "Add a near-black or deep dark color to anchor the palette."
    : balanceScore < 70
    ? "Colors cluster in similar lightness values. More value contrast will improve versatility."
    : "Good value range — the palette has lights, mids, and darks.";

  // ── Vibrancy ─────────────────────────────────────────────────────────────────
  const saturations = hsls.map(([, s]) => s);
  const avgSat = saturations.reduce((a, b) => a + b, 0) / saturations.length;
  const maxSat = Math.max(...saturations);
  let vibrancyScore = 0;
  if (maxSat >= 0.7) vibrancyScore = 80 + Math.round(avgSat * 20);
  else if (maxSat >= 0.4) vibrancyScore = 50 + Math.round(maxSat * 60);
  else if (maxSat >= 0.15) vibrancyScore = 30 + Math.round(maxSat * 80);
  else vibrancyScore = Math.round(maxSat * 200);
  vibrancyScore = Math.round(Math.min(100, Math.max(0, vibrancyScore)));
  const vibrancyDetail = `Avg saturation: ${Math.round(avgSat * 100)}% · Peak: ${Math.round(maxSat * 100)}%`;
  const vibrancyTip = maxSat < 0.15
    ? "Very low saturation — the palette feels grey/washed. Boost at least one color's saturation."
    : maxSat < 0.4
    ? "Muted palette. Add at least one punchy, saturated accent color."
    : avgSat < 0.25
    ? "Good accent color, but other colors are muted. That's fine for a subtle scheme."
    : "Great vibrancy — the palette has strong, expressive colors.";

  // ── Completeness ─────────────────────────────────────────────────────────────
  const hasBackground = lightnesses.some((l) => l >= 0.75);
  const hasTextColor = lightnesses.some((l) => l <= 0.2);
  const hasAccent = hsls.some(([, s]) => s >= 0.4);
  let completenessScore = 0;
  if (hasBackground) completenessScore += 35;
  if (hasTextColor) completenessScore += 35;
  if (hasAccent) completenessScore += 30;
  completenessScore = Math.round(completenessScore);
  const missing = [!hasBackground && "background", !hasTextColor && "text color", !hasAccent && "accent"].filter(Boolean);
  const completenessDetail = missing.length === 0
    ? "Has background, text, and accent colors"
    : `Missing: ${missing.join(", ")}`;
  const completenessTip = missing.length === 0
    ? "Complete palette — ready to use in any design system."
    : `Add a ${missing[0]} to make the palette more usable in real designs.`;

  // ── Overall ──────────────────────────────────────────────────────────────────
  const overall = Math.round(
    contrastScore * 0.25 +
    harmonyScore * 0.2 +
    balanceScore * 0.2 +
    vibrancyScore * 0.15 +
    completenessScore * 0.2,
  );

  return {
    contrast: { label: "Contrast", score: contrastScore, detail: contrastDetail, tip: contrastTip },
    harmony: { label: "Harmony", score: harmonyScore, detail: harmonyDetail, tip: harmonyTip },
    balance: { label: "Balance", score: balanceScore, detail: balanceDetail, tip: balanceTip },
    vibrancy: { label: "Vibrancy", score: vibrancyScore, detail: vibrancyDetail, tip: vibrancyTip },
    completeness: { label: "Completeness", score: completenessScore, detail: completenessDetail, tip: completenessTip },
    overall,
    grade: gradeFromScore(overall),
  };
}
