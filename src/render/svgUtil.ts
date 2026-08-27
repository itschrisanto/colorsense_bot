import { contrastRatio } from "../lib/wcagContrast.js";

export function readableTextColor(bgHex: string): string {
  const onWhite = contrastRatio(bgHex, "#FFFFFF");
  const onBlack = contrastRatio(bgHex, "#000000");
  return onWhite >= onBlack ? "#FFFFFF" : "#000000";
}

export function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
