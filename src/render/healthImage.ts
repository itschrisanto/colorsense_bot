import sharp from "sharp";
import type { HealthDimension, PaletteHealthResult } from "../lib/paletteHealth.js";
import { readableTextColor, escapeXml } from "./svgUtil.js";

const WIDTH = 700;
const HEIGHT = 500;
const RING_CX = 110;
const RING_CY = 118;
const RING_R = 80;
const RING_STROKE = 14;

const GRADE_COLORS: Record<PaletteHealthResult["grade"], string> = {
  A: "#2E9E5B",
  B: "#D9942B",
  C: "#E08E3E",
  D: "#D9622B",
  F: "#C63D3D",
};

const BAR_PASS = "#2E9E5B";
const BAR_FAIL = "#D9486B";
const BAR_THRESHOLD = 70;

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function scoreRing(score: number, grade: PaletteHealthResult["grade"]): string {
  const circumference = 2 * Math.PI * RING_R;
  const offset = circumference * (1 - score / 100);
  const color = GRADE_COLORS[grade];
  return `
    <g transform="rotate(-90 ${RING_CX} ${RING_CY})">
      <circle cx="${RING_CX}" cy="${RING_CY}" r="${RING_R}" fill="none" stroke="#E9E8ED" stroke-width="${RING_STROKE}" />
      <circle cx="${RING_CX}" cy="${RING_CY}" r="${RING_R}" fill="none" stroke="${color}" stroke-width="${RING_STROKE}"
              stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" />
    </g>
    <text x="${RING_CX}" y="${RING_CY - 4}" font-family="sans-serif" font-weight="800" font-size="42" fill="#1C1B22" text-anchor="middle">${score}</text>
    <text x="${RING_CX}" y="${RING_CY + 28}" font-family="sans-serif" font-size="16" fill="#6B6976" text-anchor="middle">Grade ${escapeXml(grade)}</text>
  `;
}

function swatchStrip(hexes: string[], x: number, y: number, width: number, height: number): string {
  const w = width / hexes.length;
  return hexes
    .map((hex, i) => {
      const sx = x + i * w;
      const textColor = readableTextColor(hex);
      return `
        <rect x="${sx}" y="${y}" width="${w}" height="${height}" fill="${escapeXml(hex)}" />
        <text x="${sx + w / 2}" y="${y + height + 20}" font-family="monospace" font-size="12" fill="#6B6976" text-anchor="middle">${escapeXml(hex)}</text>
      `;
    })
    .join("");
}

function dimensionCard(dim: HealthDimension, x: number, y: number, w: number, h: number): string {
  const barY = y + 52;
  const barW = w - 32;
  const filled = (barW * dim.score) / 100;
  const color = dim.score >= BAR_THRESHOLD ? BAR_PASS : BAR_FAIL;
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="#FFFFFF" stroke="#EDEBF2" stroke-width="1.5" />
    <text x="${x + 16}" y="${y + 30}" font-family="sans-serif" font-weight="700" font-size="15" fill="#1C1B22">${escapeXml(dim.label)}</text>
    <rect x="${x + 16}" y="${barY}" width="${barW}" height="8" rx="4" fill="#EDEBF2" />
    <rect x="${x + 16}" y="${barY}" width="${filled}" height="8" rx="4" fill="${color}" />
    <text x="${x + w - 16}" y="${y + 30}" font-family="sans-serif" font-weight="700" font-size="15" fill="${color}" text-anchor="end">${dim.score}</text>
  `;
}

/** Renders the ColorSense-style Palette Health card: a score ring, the
 * palette swatches, a one-line summary, and a 5-dimension breakdown grid —
 * mirroring the web app's own layout, as a single PNG buffer. */
export async function renderHealthImage(
  hexes: string[],
  result: PaletteHealthResult,
  summary: string,
): Promise<Buffer> {
  const summaryLines = wrapText(summary, 78);
  const summaryY = 232;
  const summarySvg = summaryLines
    .slice(0, 3)
    .map((line, i) => `<text x="24" y="${summaryY + i * 24}" font-family="sans-serif" font-size="16" fill="#3A3842">${escapeXml(line)}</text>`)
    .join("");

  const cardsY = summaryY + summaryLines.slice(0, 3).length * 24 + 20;
  const dims = [result.contrast, result.harmony, result.balance, result.vibrancy, result.completeness];
  const cols = 3;
  const gap = 12;
  const cardW = (WIDTH - 48 - gap * (cols - 1)) / cols;
  const cardH = 90;
  const cardsSvg = dims
    .map((dim, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 24 + col * (cardW + gap);
      const y = cardsY + row * (cardH + gap);
      return dimensionCard(dim, x, y, cardW, cardH);
    })
    .join("");

  const totalHeight = cardsY + cardH * 2 + gap + 24;

  const svg = `
    <svg width="${WIDTH}" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${WIDTH}" height="${totalHeight}" fill="#F7F7F5" />
      ${scoreRing(result.overall, result.grade)}
      ${swatchStrip(hexes, 220, 30, WIDTH - 220 - 24, 100)}
      ${summarySvg}
      ${cardsSvg}
    </svg>
  `;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
