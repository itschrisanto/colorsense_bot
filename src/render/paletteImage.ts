import sharp from "sharp";
import { hexToRgb } from "../lib/wcagContrast.js";
import { nameColor } from "../lib/colorNames.js";
import { readableTextColor, escapeXml, logoLockup } from "./svgUtil.js";

const OUTER_PADDING = 48;
const CARD_WIDTH = 800;
const CARD_HEIGHT = 170;
const CARD_GAP = 22;
const CARD_RADIUS = 26;
const LOGO_AREA_HEIGHT = 110;
const BG_COLOR = "#EAF1FC";

function card(hex: string, y: number): string {
  const textColor = readableTextColor(hex);
  const [r, g, b] = hexToRgb(hex);
  const name = nameColor(r, g, b);
  return `
    <rect x="${OUTER_PADDING}" y="${y}" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="${CARD_RADIUS}" fill="${escapeXml(hex)}" />
    <text x="${OUTER_PADDING + 40}" y="${y + 68}" font-family="sans-serif" font-weight="800" font-size="34" fill="${textColor}">${escapeXml(name)}</text>
    <text x="${OUTER_PADDING + 40}" y="${y + 106}" font-family="sans-serif" font-weight="700" font-size="19" letter-spacing="0.5"
          fill="${textColor}" fill-opacity="0.75">HEX ${escapeXml(hex.replace("#", ""))}</text>
  `;
}

/** Renders a palette as a vertical stack of rounded, full-width cards — name
 * and hex per color — matching the layout of a palette downloaded from
 * colorsense.online, so the bot's output looks consistent with the site's
 * own branding. Shared by photo extraction and /harmony results. */
export async function renderPaletteImage(hexes: string[]): Promise<Buffer> {
  const width = CARD_WIDTH + OUTER_PADDING * 2;
  const stackHeight = hexes.length * CARD_HEIGHT + (hexes.length - 1) * CARD_GAP;
  const height = OUTER_PADDING + stackHeight + LOGO_AREA_HEIGHT;

  const cards = hexes
    .map((hex, i) => card(hex, OUTER_PADDING + i * (CARD_HEIGHT + CARD_GAP)))
    .join("");

  const logoY = OUTER_PADDING + stackHeight + LOGO_AREA_HEIGHT / 2 + 8;

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" fill="${BG_COLOR}" />
      ${cards}
      ${logoLockup(width / 2, logoY)}
    </svg>
  `;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
