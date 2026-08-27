import sharp from "sharp";
import type { WcagVerdict } from "../lib/wcagContrast.js";
import { escapeXml } from "./svgUtil.js";

const WIDTH = 640;
const HEIGHT = 400;

interface Badge {
  label: string;
  ratio: string;
  pass: boolean;
}

function badgeGroup(badges: Badge[], x: number, y: number): string {
  const cols = 2;
  const gap = 12;
  const badgeW = (388 - gap) / cols;
  const badgeH = (140 - gap) / 2;

  return badges
    .map((badge, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const bx = x + col * (badgeW + gap);
      const by = y + row * (badgeH + gap);
      const fill = badge.pass ? "#E3F5E9" : "#FBE6E6";
      const textColor = badge.pass ? "#1F8A4C" : "#C63D3D";
      const status = badge.pass ? "PASS" : "FAIL";
      return `
        <rect x="${bx}" y="${by}" width="${badgeW}" height="${badgeH}" rx="10" fill="${fill}" />
        <text x="${bx + badgeW / 2}" y="${by + badgeH / 2 + 5}" font-family="sans-serif" font-weight="700"
              font-size="13" fill="${textColor}" text-anchor="middle">${escapeXml(badge.label)} ${escapeXml(badge.ratio)} — ${status}</text>
      `;
    })
    .join("");
}

/** Renders a contrast-checker preview image: fg-on-bg sample text, the
 * ratio + grade, and a pass/fail badge grid — mirroring ColorSense's own
 * web contrast checker, as a PNG buffer. */
export async function renderContrastImage(fg: string, bg: string, result: WcagVerdict): Promise<Buffer> {
  const badges: Badge[] = [
    { label: "AA Normal", ratio: "4.5:1", pass: result.aaNormal },
    { label: "AA Large", ratio: "3:1", pass: result.aaLarge },
    { label: "AAA Normal", ratio: "7:1", pass: result.aaaNormal },
    { label: "AAA Large", ratio: "4.5:1", pass: result.aaaLarge },
  ];

  const svg = `
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="#FFFFFF" />

      <rect x="24" y="24" width="592" height="170" rx="14" fill="${escapeXml(bg)}" />
      <text x="44" y="58" font-family="sans-serif" font-size="13" fill="${escapeXml(fg)}" fill-opacity="0.7">Normal text — 16px</text>
      <text x="44" y="104" font-family="sans-serif" font-weight="600" font-size="22" fill="${escapeXml(fg)}">The quick brown fox</text>
      <text x="44" y="164" font-family="sans-serif" font-weight="800" font-size="32" fill="${escapeXml(fg)}">Large headline</text>

      <rect x="24" y="218" width="180" height="140" rx="14" fill="#F5F5F7" />
      <text x="114" y="248" font-family="sans-serif" font-size="12" font-weight="700" fill="#6B6976" text-anchor="middle" letter-spacing="0.5">CONTRAST RATIO</text>
      <text x="114" y="303" font-family="sans-serif" font-weight="800" font-size="34" fill="#1C1B22" text-anchor="middle">${escapeXml(result.ratioFormatted)}</text>
      <text x="114" y="338" font-family="sans-serif" font-size="13" fill="#6B6976" text-anchor="middle">BEST GRADE: ${escapeXml(result.bestGrade)}</text>

      ${badgeGroup(badges, 228, 218)}
    </svg>
  `;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
