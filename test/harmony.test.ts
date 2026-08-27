import { describe, expect, it } from "vitest";
import { getHarmonyColors } from "../src/lib/harmony.js";

const HEX_RE = /^#[0-9A-F]{6}$/;

describe("getHarmonyColors", () => {
  it("returns the expected color count per harmony type", () => {
    expect(getHarmonyColors("#FF0000", "complementary")).toHaveLength(2);
    expect(getHarmonyColors("#FF0000", "monochromatic")).toHaveLength(5);
    expect(getHarmonyColors("#FF0000", "analogous")).toHaveLength(3);
    expect(getHarmonyColors("#FF0000", "split-complementary")).toHaveLength(3);
    expect(getHarmonyColors("#FF0000", "triadic")).toHaveLength(3);
    expect(getHarmonyColors("#FF0000", "tetradic")).toHaveLength(4);
  });

  it("always returns valid hex codes and keeps the base color first", () => {
    const colors = getHarmonyColors("#1f5313", "triadic");
    for (const hex of colors) {
      expect(hex).toMatch(HEX_RE);
    }
    expect(colors[0]).toBe("#1F5313");
  });

  it("rotates the complementary color by roughly 180 degrees of hue", () => {
    const [base, complement] = getHarmonyColors("#FF0000", "complementary");
    expect(base).toBe("#FF0000");
    // Red's complement should land in the cyan family (low R, high G and B).
    expect(complement).toBe("#00FFFF");
  });
});
