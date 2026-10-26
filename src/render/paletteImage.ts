import sharp from "sharp";
import { hexToRgb } from "../lib/wcagContrast.js";
import { hexToCmyk } from "../lib/cmyk.js";
import { nameColor } from "../lib/colorNames.js";
import { readableTextColor, escapeXml, logoLockup } from "./svgUtil.js";

const WIDTH = 1080;
const BAND_HEIGHT = 270;
const LEFT_PADDING = 72;

function band(hex: string, index: number, isLast: boolean): string {
  const y = index * BAND_HEIGHT;
  const textColor = readableTextColor(hex);
  const [r, g, b] = hexToRgb(hex);
  const { c, m, y: yellow, k } = hexToCmyk(hex);
  const name = nameColor(r, g, b);
  const mutedOpacity = textColor === "#FFFFFF" ? 0.82 : 0.72;

  return `
    <rect x="0" y="${y}" width="${WIDTH}" height="${BAND_HEIGHT}" fill="${escapeXml(hex)}" />
    <text x="${LEFT_PADDING}" y="${y + 130}" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="46" letter-spacing="0.5" fill="${textColor}">${escapeXml(name.toUpperCase())}</text>
    <text y="${y + 181}" font-family="Menlo, Monaco, monospace" font-size="21" fill="${textColor}">
      <tspan x="72" fill-opacity="${mutedOpacity}">HEX</tspan><tspan x="122">${escapeXml(hex.toUpperCase())}</tspan>
      <tspan x="253" fill-opacity="${mutedOpacity}">RGB</tspan><tspan x="303">${r} ${g} ${b}</tspan>
      <tspan x="489" fill-opacity="${mutedOpacity}">CMYK</tspan><tspan x="552">${c} ${m} ${yellow} ${k}</tspan>
    </text>
    ${isLast ? logoLockup(932, y + 224, textColor) : ""}
  `;
}

/** Renders the iOS share-card layout: one edge-to-edge band per color with
 * its name and HEX, RGB, and CMYK values. Shared by every palette result. */
export async function renderPaletteImage(hexes: string[]): Promise<Buffer> {
  if (hexes.length === 0) throw new Error("Cannot render an empty palette");
  const height = hexes.length * BAND_HEIGHT;
  const bands = hexes.map((hex, i) => band(hex, i, i === hexes.length - 1)).join("");

  const svg = `
    <svg width="${WIDTH}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${bands}
    </svg>
  `;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
