import sharp from "sharp";
import type { HierarchySplit, Entry } from "../lib/paletteHealthReport.js";
import { mayShiftInPrint } from "../lib/cmyk.js";
import { readableTextColor, escapeXml } from "./svgUtil.js";

const WIDTH = 640;

function hierarchyBar(split: HierarchySplit[], y: number, height: number): string {
  let x = 24;
  const totalWidth = WIDTH - 48;
  return split
    .map((seg) => {
      const w = (totalWidth * seg.pct) / 100;
      const textColor = readableTextColor(seg.hex);
      const label = `${seg.pct}% ${seg.name}`;
      const svg = `
        <rect x="${x}" y="${y}" width="${w}" height="${height}" fill="${escapeXml(seg.hex)}" />
        <text x="${x + w / 2}" y="${y + height / 2 + 6}" font-family="sans-serif" font-weight="700" font-size="${seg.pct >= 30 ? 15 : 12}"
              fill="${textColor}" text-anchor="middle">${seg.pct >= 15 ? escapeXml(label) : ""}</text>
      `;
      x += w;
      return svg;
    })
    .join("");
}

function printPill(entry: Entry, x: number, y: number): { svg: string; width: number } {
  const ok = !mayShiftInPrint(entry.hex);
  const color = ok ? "#1F8A4C" : "#B8860B";
  const bg = ok ? "#E3F5E9" : "#FDF1DC";
  const mark = ok ? "check" : "warn";
  const label = entry.name;
  const width = 22 + label.length * 8 + 24;
  const svg = `
    <rect x="${x}" y="${y}" width="${width}" height="34" rx="17" fill="${bg}" />
    ${
      mark === "check"
        ? `<circle cx="${x + 18}" cy="${y + 17}" r="8" fill="none" stroke="${color}" stroke-width="1.6" /><path d="M ${x + 14} ${y + 17} l 3 3 l 6 -7" stroke="${color}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" />`
        : `<circle cx="${x + 18}" cy="${y + 17}" r="8" fill="none" stroke="${color}" stroke-width="1.6" /><text x="${x + 18}" y="${y + 22}" font-family="sans-serif" font-weight="800" font-size="12" fill="${color}" text-anchor="middle">!</text>`
    }
    <text x="${x + 32}" y="${y + 22}" font-family="sans-serif" font-weight="600" font-size="13" fill="#1C1B22">${escapeXml(label)}</text>
  `;
  return { svg, width };
}

function printPillRow(entries: Entry[], y: number): string {
  let x = 24;
  const gap = 10;
  return entries
    .map((e) => {
      const { svg, width } = printPill(e, x, y);
      x += width + gap;
      return svg;
    })
    .join("");
}

/** Renders the "Design guidance" card: the 60/30/10 hierarchy bar and the
 * CMYK print-versatility pills — mirroring the web app's guidance section,
 * clearly framed as opinion rather than score, as a PNG buffer. */
export async function renderDesignGuidanceImage(split: HierarchySplit[], entries: Entry[]): Promise<Buffer> {
  const barY = 130;
  const barHeight = 56;
  const pillY = barY + barHeight + 76;
  const height = pillY + 34 + 24;

  const svg = `
    <svg width="${WIDTH}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${WIDTH}" height="${height}" fill="#FFFFFF" />
      <text x="24" y="30" font-family="sans-serif" font-weight="800" font-size="19" fill="#1C1B22">Design guidance</text>
      <text x="24" y="52" font-family="sans-serif" font-size="13" fill="#6B6976">Opinions, clearly labeled as opinions — not part of your score.</text>

      <text x="24" y="${barY - 14}" font-family="sans-serif" font-weight="700" font-size="15" fill="#1C1B22">60/30/10 hierarchy</text>
      <text x="${WIDTH - 24}" y="${barY - 14}" font-family="sans-serif" font-size="12" fill="#6B6976" text-anchor="end">a balanced starting split</text>
      <g>
        <clipPath id="barclip"><rect x="24" y="${barY}" width="${WIDTH - 48}" height="${barHeight}" rx="14" /></clipPath>
        <g clip-path="url(#barclip)">${hierarchyBar(split, barY, barHeight)}</g>
      </g>

      <text x="24" y="${barY + barHeight + 40}" font-family="sans-serif" font-weight="700" font-size="15" fill="#1C1B22">Print versatility (CMYK)</text>
      <text x="${WIDTH - 24}" y="${barY + barHeight + 40}" font-family="sans-serif" font-size="12" fill="#B8860B" text-anchor="end">Estimate — soft-proof first</text>
      ${printPillRow(entries, pillY)}
    </svg>
  `;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
