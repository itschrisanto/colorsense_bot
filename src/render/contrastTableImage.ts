import sharp from "sharp";
import type { ContrastRow } from "../lib/paletteHealthReport.js";
import { escapeXml } from "./svgUtil.js";

const WIDTH = 640;
const ROW_HEIGHT = 92;
const HEADER_HEIGHT = 76;

const TONE_COLORS: Record<ContrastRow["tone"], { bg: string; text: string }> = {
  pass: { bg: "#E3F5E9", text: "#1F8A4C" },
  warn: { bg: "#FDF1DC", text: "#B8860B" },
  fail: { bg: "#FBE6E6", text: "#C63D3D" },
};

function row(r: ContrastRow, y: number): string {
  const chipY = y + 14;
  const tone = TONE_COLORS[r.tone];
  const badgeW = 96;
  return `
    <line x1="24" y1="${y}" x2="${WIDTH - 24}" y2="${y}" stroke="#EDEBF2" stroke-width="1" />
    <rect x="24" y="${chipY}" width="64" height="64" rx="14" fill="${escapeXml(r.bg)}" />
    <text x="56" y="${chipY + 40}" font-family="sans-serif" font-weight="700" font-size="22" fill="${escapeXml(r.fg)}" text-anchor="middle">Aa</text>
    <text x="104" y="${y + 34}" font-family="monospace" font-size="13" fill="#6B6976">${escapeXml(r.fg)} on ${escapeXml(r.bg)}</text>
    <text x="104" y="${y + 62}" font-family="sans-serif" font-weight="800" font-size="22" fill="#1C1B22">${escapeXml(r.ratio)}</text>
    <rect x="${WIDTH - 24 - badgeW}" y="${y + 32}" width="${badgeW}" height="32" rx="16" fill="${tone.bg}" />
    <text x="${WIDTH - 24 - badgeW / 2}" y="${y + 53}" font-family="sans-serif" font-weight="700" font-size="13" fill="${tone.text}" text-anchor="middle">${escapeXml(r.verdict)}</text>
  `;
}

/** Renders the "Text contrast — measured" table: each row a swatch chip,
 * the exact pairing and ratio, and a pass/warn/fail badge — mirroring the
 * web app's Palette Health contrast breakdown, as a PNG buffer. */
export async function renderContrastTableImage(rows: ContrastRow[]): Promise<Buffer> {
  const height = HEADER_HEIGHT + rows.length * ROW_HEIGHT + 24;
  const rowsSvg = rows.map((r, i) => row(r, HEADER_HEIGHT + i * ROW_HEIGHT)).join("");

  const svg = `
    <svg width="${WIDTH}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${WIDTH}" height="${height}" fill="#FFFFFF" />
      <text x="24" y="30" font-family="sans-serif" font-weight="800" font-size="19" fill="#1C1B22">Text contrast — measured</text>
      <text x="24" y="52" font-family="sans-serif" font-size="13" fill="#6B6976">Real ratios, not a vibe — the foreground each surface would actually use.</text>
      ${rowsSvg}
    </svg>
  `;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
