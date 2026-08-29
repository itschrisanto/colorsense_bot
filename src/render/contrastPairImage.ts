import sharp from "sharp";
import { evaluate } from "../lib/wcagContrast.js";
import { escapeXml, logoLockup } from "./svgUtil.js";

const WIDTH = 1080;
const HALF_HEIGHT = 550;
const FOOTER_HEIGHT = 110;
const PADDING_X = 100;
const FOOTER_BG = "#EAF1FC";

/** Renders a single color pairing as a full-bleed, shareable card: the
 * darker/text color on top, the surface color on bottom, each labeled in
 * the *other* color's hue so the pairing visually proves itself, with the
 * ratio and grade shown on the surface half and the ColorSense logo lockup
 * in a dedicated footer strip. One pair per image — the interactive
 * counterpart to /health's aggregate contrast table. */
export async function renderContrastPairImage(
  fgHex: string,
  fgName: string,
  bgHex: string,
  bgName: string,
): Promise<Buffer> {
  const result = evaluate(fgHex, bgHex);
  const badgeText = result.bestGrade === "Fail" ? "Fails" : result.bestGrade;
  const badgeWidth = 60 + badgeText.length * 22;

  const height = HALF_HEIGHT * 2 + FOOTER_HEIGHT;

  const svg = `
    <svg width="${WIDTH}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${WIDTH}" height="${height}" fill="${FOOTER_BG}" />

      <rect x="0" y="0" width="${WIDTH}" height="${HALF_HEIGHT}" fill="${escapeXml(fgHex)}" />
      <text x="${PADDING_X}" y="${HALF_HEIGHT - 130}" font-family="sans-serif" font-weight="800" font-size="56" fill="${escapeXml(bgHex)}">${escapeXml(fgName)}</text>
      <text x="${PADDING_X}" y="${HALF_HEIGHT - 78}" font-family="sans-serif" font-weight="700" font-size="26" letter-spacing="0.5"
            fill="${escapeXml(bgHex)}" fill-opacity="0.9">HEX ${escapeXml(fgHex.replace("#", ""))}</text>

      <rect x="0" y="${HALF_HEIGHT}" width="${WIDTH}" height="${HALF_HEIGHT}" fill="${escapeXml(bgHex)}" />
      <text x="${PADDING_X}" y="${HALF_HEIGHT + 70}" font-family="sans-serif" font-weight="800" font-size="34" fill="${escapeXml(fgHex)}">${escapeXml(result.ratioFormatted)}</text>
      <text x="${PADDING_X}" y="${HALF_HEIGHT + 106}" font-family="sans-serif" font-weight="600" font-size="24" fill="${escapeXml(fgHex)}" fill-opacity="0.85">Contrast</text>
      <rect x="${WIDTH - PADDING_X - badgeWidth}" y="${HALF_HEIGHT + 48}" width="${badgeWidth}" height="56" rx="14" fill="${escapeXml(fgHex)}" />
      <text x="${WIDTH - PADDING_X - badgeWidth / 2}" y="${HALF_HEIGHT + 84}" font-family="sans-serif" font-weight="800" font-size="26"
            fill="${escapeXml(bgHex)}" text-anchor="middle">${escapeXml(badgeText)}</text>

      <text x="${PADDING_X}" y="${HALF_HEIGHT * 2 - 130}" font-family="sans-serif" font-weight="800" font-size="56" fill="${escapeXml(fgHex)}">${escapeXml(bgName)}</text>
      <text x="${PADDING_X}" y="${HALF_HEIGHT * 2 - 78}" font-family="sans-serif" font-weight="700" font-size="26" letter-spacing="0.5"
            fill="${escapeXml(fgHex)}" fill-opacity="0.9">HEX ${escapeXml(bgHex.replace("#", ""))}</text>

      ${logoLockup(WIDTH / 2, HALF_HEIGHT * 2 + FOOTER_HEIGHT / 2 + 8)}
    </svg>
  `;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
