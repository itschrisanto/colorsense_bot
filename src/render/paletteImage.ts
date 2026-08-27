import sharp from "sharp";
import { hexToRgb } from "../lib/wcagContrast.js";
import { nameColor } from "../lib/colorNames.js";
import { readableTextColor, escapeXml } from "./svgUtil.js";

const SWATCH_SIZE = 220;

/** Renders a row of colored swatches, each labeled with its name and hex code, as a PNG buffer. */
export async function renderPaletteImage(hexes: string[]): Promise<Buffer> {
  const width = SWATCH_SIZE * hexes.length;
  const height = SWATCH_SIZE;

  const rects = hexes
    .map((hex, i) => {
      const x = i * SWATCH_SIZE;
      const textColor = readableTextColor(hex);
      const [r, g, b] = hexToRgb(hex);
      const name = nameColor(r, g, b);
      return `
        <rect x="${x}" y="0" width="${SWATCH_SIZE}" height="${height}" fill="${escapeXml(hex)}" />
        <text x="${x + SWATCH_SIZE / 2}" y="${height - 46}" font-family="sans-serif" font-weight="bold" font-size="16"
              fill="${textColor}" text-anchor="middle">${escapeXml(name)}</text>
        <text x="${x + SWATCH_SIZE / 2}" y="${height - 22}" font-family="monospace" font-size="16"
              fill="${textColor}" text-anchor="middle">${escapeXml(hex)}</text>
      `;
    })
    .join("");

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
