import sharp from "sharp";
import { escapeXml } from "./svgUtil.js";

const COLUMNS = 2;
const CARD_WIDTH = 380;
const CARD_HEIGHT = 170;
const CARD_GAP = 20;
const SWATCH_HEIGHT = 100;
const SWATCH_RADIUS = 16;
const CARD_RADIUS = 20;

export type GridRow = { name: string; colors: string[] };

/** Renders a 2-column grid of palette cards (rounded swatch bar + name below), as a PNG buffer. */
export async function renderPaletteGridImage(rows: GridRow[]): Promise<Buffer> {
  const rowCount = Math.ceil(rows.length / COLUMNS);
  const width = CARD_GAP + COLUMNS * (CARD_WIDTH + CARD_GAP);
  const height = CARD_GAP + rowCount * (CARD_HEIGHT + CARD_GAP);

  const cards = rows
    .map((row, i) => {
      const col = i % COLUMNS;
      const line = Math.floor(i / COLUMNS);
      const cardX = CARD_GAP + col * (CARD_WIDTH + CARD_GAP);
      const cardY = CARD_GAP + line * (CARD_HEIGHT + CARD_GAP);
      const colors = row.colors.length > 0 ? row.colors : ["#E2E8F0"];
      const segWidth = CARD_WIDTH / colors.length;

      const segments = colors
        .map((hex, s) => `<rect x="${cardX + s * segWidth}" y="${cardY}" width="${segWidth}" height="${SWATCH_HEIGHT}" fill="${escapeXml(hex)}" />`)
        .join("");

      return `
        <clipPath id="clip-${i}">
          <rect x="${cardX}" y="${cardY}" width="${CARD_WIDTH}" height="${SWATCH_HEIGHT}" rx="${SWATCH_RADIUS}" ry="${SWATCH_RADIUS}" />
        </clipPath>
        <g clip-path="url(#clip-${i})">${segments}</g>
        <rect x="${cardX}" y="${cardY}" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="${CARD_RADIUS}" ry="${CARD_RADIUS}"
              fill="none" stroke="#E2E8F0" stroke-width="2" />
        <text x="${cardX + 18}" y="${cardY + SWATCH_HEIGHT + 40}" font-family="sans-serif" font-size="18" font-weight="600"
              fill="#334155">${escapeXml(row.name)}</text>
      `;
    })
    .join("");

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="#FFFFFF" />
    ${cards}
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
