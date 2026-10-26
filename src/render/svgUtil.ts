import { contrastRatio } from "../lib/wcagContrast.js";

export function readableTextColor(bgHex: string): string {
  const onWhite = contrastRatio(bgHex, "#FFFFFF");
  const onBlack = contrastRatio(bgHex, "#000000");
  return onWhite >= onBlack ? "#FFFFFF" : "#000000";
}

export function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** The 2x2 mark + "ColorSense" wordmark, matching the product branding. */
export function logoLockup(centerX: number, y: number, textColor = "#1C1B22"): string {
  const sq = 15;
  const gap = 4;
  const iconW = sq * 2 + gap;
  const wordmarkWidth = 145; // approx, for centering the whole lockup
  const totalWidth = iconW + 14 + wordmarkWidth;
  const startX = centerX - totalWidth / 2;
  const iconX = startX;
  const iconY = y - iconW / 2;

  return `
    <rect x="${iconX}" y="${iconY}" width="${sq}" height="${sq}" rx="4" fill="#F45B69" />
    <rect x="${iconX + sq + gap}" y="${iconY}" width="${sq}" height="${sq}" rx="4" fill="#14B8A6" />
    <rect x="${iconX}" y="${iconY + sq + gap}" width="${sq}" height="${sq}" rx="4" fill="#F5A623" />
    <rect x="${iconX + sq + gap}" y="${iconY + sq + gap}" width="${sq}" height="${sq}" rx="4" fill="#8B5CF6" />
    <text x="${iconX + iconW + 14}" y="${y + 10}" font-family="sans-serif" font-weight="700" font-size="26" fill="${textColor}">ColorSense</text>
  `;
}
