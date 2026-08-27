/**
 * Palette extractor — a Node port of the browser-only extractor at
 * artifacts/chrome-extension/src/lib/colorExtractor.ts, which uses `colorthief`
 * on an HTML canvas. There's no DOM in Node, so this uses `sharp` to decode/
 * downscale the image and feeds the raw pixels into `quantize` — the same
 * MMCQ algorithm `colorthief` wraps internally — then mirrors the exact same
 * over-extraction, dedup, and pad logic so output quality matches the rest
 * of the product.
 */

import sharp from "sharp";
import quantize from "quantize";

const MAX_EDGE = 300;

function rgbToHex([r, g, b]: [number, number, number]): string {
  // `quantize`'s histogram-bucket averaging can round a channel to 256 at
  // color extremes (e.g. pure red/blue inputs) — clamp before converting.
  const toHex = (n: number) => Math.min(255, Math.max(0, Math.round(n))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Dedupes near-identical colors (Manhattan distance < 30) and pads back up
 * from the raw list if dedupe left us short of `count`. Mirrors
 * colorExtractor.ts's loop exactly. Exported separately from `extractPalette`
 * so it can be unit-tested without going through `quantize`, whose own
 * histogram-bucket approximation makes exact output colors non-deterministic
 * to assert against in an end-to-end test.
 */
export function dedupeAndPad(rgbs: [number, number, number][], count: number): string[] {
  const hexes: string[] = [];
  for (const rgb of rgbs) {
    if (hexes.length >= count) break;
    const isDup = hexes.some((existing) => {
      const er = parseInt(existing.slice(1, 3), 16);
      const eg = parseInt(existing.slice(3, 5), 16);
      const eb = parseInt(existing.slice(5, 7), 16);
      return Math.abs(er - rgb[0]) + Math.abs(eg - rgb[1]) + Math.abs(eb - rgb[2]) < 30;
    });
    if (!isDup) hexes.push(rgbToHex(rgb));
  }
  // Pad from the raw list if dedupe left us short
  for (const rgb of rgbs) {
    if (hexes.length >= count) break;
    const hex = rgbToHex(rgb);
    if (!hexes.includes(hex)) hexes.push(hex);
  }
  return hexes;
}

/** Extract a `count`-color palette from an image buffer. */
export async function extractPalette(buffer: Buffer, count = 5): Promise<string[]> {
  const { data, info } = await sharp(buffer)
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels: [number, number, number][] = [];
  for (let i = 0; i + info.channels <= data.length; i += info.channels) {
    pixels.push([data[i]!, data[i + 1]!, data[i + 2]!]);
  }
  if (pixels.length === 0) return [];

  const colorMap = quantize(pixels, Math.max(count * 2, 12));
  if (!colorMap) return [];

  return dedupeAndPad(colorMap.palette(), count);
}
