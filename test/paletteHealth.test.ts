import { describe, expect, it } from "vitest";
import { scorePalette } from "../src/lib/paletteHealth.js";

describe("scorePalette", () => {
  it("grades a high-contrast, balanced, vibrant palette well", () => {
    const result = scorePalette(["#000000", "#FFFFFF", "#FF0000"]);
    expect(result.contrast.score).toBeGreaterThan(80);
    expect(["A", "B"]).toContain(result.grade);
  });

  it("penalizes a low-contrast, washed-out palette", () => {
    const result = scorePalette(["#CCCCCC", "#D0D0D0"]);
    expect(result.contrast.score).toBeLessThan(50);
  });

  it("returns a Fail-shaped result for fewer than 2 colors", () => {
    const result = scorePalette(["#FF0000"]);
    expect(result.overall).toBe(0);
    expect(result.grade).toBe("F");
  });

  it("always returns a score in 0-100 for every dimension", () => {
    const result = scorePalette(["#264653", "#F4A261", "#2A9D8F", "#E9C46A"]);
    for (const dim of [result.contrast, result.harmony, result.balance, result.vibrancy, result.completeness]) {
      expect(dim.score).toBeGreaterThanOrEqual(0);
      expect(dim.score).toBeLessThanOrEqual(100);
    }
  });
});
