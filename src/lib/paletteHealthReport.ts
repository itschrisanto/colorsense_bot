// Ported from artifacts/color-palette/src/lib/paletteHealthReport.ts (the
// contrast-table, 60/30/10 hierarchy, and summary-narrative logic) and the
// inline `meta` useMemo in HealthPanel.tsx (the 60/30/10 split itself isn't
// a standalone export on the website — extracted here into computeHierarchy
// so the bot can reuse it the same way).
import { evaluate, relativeLuminance, hexToRgb, rgbToHsl } from "./wcagContrast.js";
import { confusablePairs, CB_LABELS, type CbType } from "./colorBlind.js";

export type Entry = { hex: string; name: string };

export type ContrastRow = {
  fg: string;
  bg: string;
  bgName: string;
  bgIndex: number;
  ratio: string;
  ratioNum: number;
  verdict: string;
  tone: "pass" | "warn" | "fail";
};

function verdictTone(grade: string): "pass" | "warn" | "fail" {
  if (grade === "AAA" || grade === "AA") return "pass";
  if (grade === "AA Large") return "warn";
  return "fail";
}

/** Measure the pairing for a single surface (color at `idx`): pick the
 * foreground a designer would actually use (white on dark/vivid surfaces,
 * the darkest brand color on light surfaces) and measure it exactly. */
export function measurePairAt(colors: Entry[], idx: number): ContrastRow {
  const lums = colors.map((c) => relativeLuminance(hexToRgb(c.hex)));
  const darkIdx = lums.indexOf(Math.min(...lums));
  const bg = colors[idx]!.hex;
  const fg = lums[idx]! >= 0.4 ? colors[darkIdx]!.hex : "#FFFFFF";
  const v = evaluate(fg, bg);
  return {
    fg,
    bg,
    bgName: colors[idx]!.name,
    bgIndex: idx,
    ratio: v.ratioFormatted,
    ratioNum: v.ratio,
    verdict: v.bestGrade === "Fail" ? "Fails" : v.bestGrade,
    tone: verdictTone(v.bestGrade),
  };
}

/** Every color except the palette's darkest (reserved as the foreground
 * candidate for light surfaces) gets measured as a background, sorted
 * weakest-contrast-first. */
export function buildContrastRows(colors: Entry[]): ContrastRow[] {
  if (colors.length < 2) return [];
  const lums = colors.map((c) => relativeLuminance(hexToRgb(c.hex)));
  const darkIdx = lums.indexOf(Math.min(...lums));
  return colors
    .map((_, i) => i)
    .filter((i) => i !== darkIdx)
    .map((i) => measurePairAt(colors, i))
    .sort((a, b) => a.ratioNum - b.ratioNum);
}

export type HierarchySplit = { hex: string; name: string; pct: 60 | 30 | 10 };

/** 60/30/10 design guidance: dominant = darkest, accent = most saturated,
 * secondary = whichever remaining color sits closest to mid-lightness. */
export function computeHierarchy(entries: Entry[]): HierarchySplit[] {
  const arr = entries.map((c, i) => {
    const [, s] = rgbToHsl(...hexToRgb(c.hex));
    return { ...c, i, lum: relativeLuminance(hexToRgb(c.hex)), sat: s };
  });
  const accent = [...arr].sort((a, b) => b.sat - a.sat)[0]!;
  const dominant = [...arr].sort((a, b) => a.lum - b.lum)[0]!;
  const secondary =
    [...arr]
      .filter((c) => c.i !== dominant.i && c.i !== accent.i)
      .sort((a, b) => Math.abs(a.lum - 0.5) - Math.abs(b.lum - 0.5))[0] ?? accent;
  return [
    { hex: dominant.hex, name: dominant.name, pct: 60 },
    { hex: secondary.hex, name: secondary.name, pct: 30 },
    { hex: accent.hex, name: accent.name, pct: 10 },
  ];
}

export type Summary = { text: string; issueCount: number };

/** Builds the same one-line diagnostic narrative the website shows — the
 * grade-based lead sentence plus the single most pressing issue found
 * (a failing contrast pair, or a color-blindness confusable pair). */
export function buildSummary(
  contrastRows: ContrastRow[],
  entries: Entry[],
  overall: number,
  cbType: CbType,
): Summary {
  const confusable = confusablePairs(
    entries.map((e) => e.hex),
    cbType,
  );
  const failRows = contrastRows.filter((r) => r.tone === "fail");
  const warnRows = contrastRows.filter((r) => r.tone === "warn");
  const issueCount = failRows.length + confusable.length;

  const gradeWord =
    overall >= 85
      ? "An excellent, well-rounded palette"
      : overall >= 70
      ? "A confident, balanced palette"
      : overall >= 55
      ? "A workable palette with room to tighten up"
      : "This palette needs attention before shipping";

  const parts: string[] = [];
  if (failRows.length > 0) {
    const r = failRows[0]!;
    parts.push(`white/dark text on ${r.bgName} fails contrast (${r.ratio})`);
  }
  if (confusable.length > 0) {
    const p = confusable[0]!;
    parts.push(`${entries[p.i]!.name} and ${entries[p.j]!.name} are hard to tell apart under ${CB_LABELS[cbType].label.toLowerCase()}`);
  }

  let lead: string;
  if (issueCount === 0) {
    lead =
      warnRows.length > 0
        ? `${gradeWord}. No blocking issues — ${warnRows.length === 1 ? "one pairing only passes" : `${warnRows.length} pairings only pass`} for large text.`
        : `${gradeWord}. No accessibility issues found — every text pairing and color-blind check passes.`;
  } else {
    lead = `${gradeWord}. ${issueCount === 1 ? "One real problem" : `${issueCount} real problems`} to fix: ${parts.join("; ")}.`;
  }

  return { text: `${lead} Everything below is measured, not guessed.`, issueCount };
}
