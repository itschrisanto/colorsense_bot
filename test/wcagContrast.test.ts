import { describe, expect, it } from "vitest";
import { contrastRatio, evaluate, isValidHex, normalizeHex } from "../src/lib/wcagContrast.js";

describe("wcagContrast", () => {
  it("computes maximum contrast between black and white", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
  });

  it("matches WCAG's own #767676 / #FFFFFF borderline AA example", () => {
    const verdict = evaluate("#767676", "#FFFFFF");
    expect(verdict.aaNormal).toBe(true);
    expect(verdict.aaaNormal).toBe(false);
  });

  it("fails a low-contrast pair", () => {
    const verdict = evaluate("#777777", "#808080");
    expect(verdict.bestGrade).toBe("Fail");
  });

  it("validates and normalizes hex strings", () => {
    expect(isValidHex("notahex")).toBe(false);
    expect(isValidHex("#fff")).toBe(true);
    expect(normalizeHex("#fff")).toBe("#FFFFFF");
  });
});
