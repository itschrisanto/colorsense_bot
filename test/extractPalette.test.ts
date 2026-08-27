import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { dedupeAndPad, extractPalette } from "../src/lib/extractPalette.js";

const HEX_RE = /^#[0-9A-F]{6}$/;

describe("dedupeAndPad", () => {
  it("collapses a near-identical color so it doesn't consume a slot", () => {
    // [17,17,17] is within Manhattan distance 30 of [16,16,16] and should be
    // dropped, leaving room for the genuinely distinct third color.
    const hexes = dedupeAndPad(
      [
        [16, 16, 16],
        [17, 17, 17],
        [200, 50, 50],
      ],
      2,
    );
    expect(hexes).toEqual(["#101010", "#C83232"]);
  });

  it("keeps distinct colors separate", () => {
    const hexes = dedupeAndPad(
      [
        [255, 0, 0],
        [0, 0, 255],
      ],
      5,
    );
    expect(hexes).toEqual(["#FF0000", "#0000FF"]);
  });

  it("pads back in a near-duplicate if there aren't enough distinct raw colors to reach count", () => {
    // Only 2 unique-enough colors exist, but count=3 is requested, so the
    // pad pass re-admits [17,17,17] (exact-hex check, not distance) to fill
    // the slot — matching colorExtractor.ts's own behavior.
    const hexes = dedupeAndPad(
      [
        [16, 16, 16],
        [17, 17, 17],
        [200, 50, 50],
      ],
      3,
    );
    expect(hexes).toEqual(["#101010", "#C83232", "#111111"]);
  });

  it("clamps out-of-range channel values (quantize's own 256 rounding quirk)", () => {
    const hexes = dedupeAndPad([[256, 4, 4]], 5);
    expect(hexes[0]).toMatch(HEX_RE);
    expect(hexes[0]).toBe("#FF0404");
  });
});

describe("extractPalette", () => {
  it("returns 1-5 valid hex colors for a real two-color image", async () => {
    const width = 40;
    const height = 20;
    const channels = 3;
    const raw = Buffer.alloc(width * height * channels);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const [r, g, b] = x < 20 ? [255, 0, 0] : [0, 0, 255];
        const i = (y * width + x) * channels;
        raw[i] = r;
        raw[i + 1] = g;
        raw[i + 2] = b;
      }
    }
    const buffer = await sharp(raw, { raw: { width, height, channels } }).png().toBuffer();

    const hexes = await extractPalette(buffer, 5);

    expect(hexes.length).toBeGreaterThan(0);
    expect(hexes.length).toBeLessThanOrEqual(5);
    for (const hex of hexes) {
      expect(hex).toMatch(HEX_RE);
    }
  });
});
