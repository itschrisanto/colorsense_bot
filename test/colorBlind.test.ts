import { describe, expect, it } from "vitest";
import { confusablePairs, simulateHex } from "../src/lib/colorBlind.js";

describe("simulateHex", () => {
  it("leaves grayscale colors essentially unchanged (no hue for the matrix to distort)", () => {
    expect(simulateHex("#808080", "deuteranopia")).toBe("#808080");
  });
});

describe("confusablePairs", () => {
  it("flags Rhino and Butterfly Bush as confusable under deuteranopia", () => {
    const hexes = ["#212B3B", "#343665", "#60498D", "#9D6BB3", "#D0AACD"];
    const pairs = confusablePairs(hexes, "deuteranopia");
    expect(pairs.some((p) => (p.i === 1 && p.j === 2) || (p.i === 2 && p.j === 1))).toBe(true);
  });

  it("does not flag black and white as confusable under any type", () => {
    const pairs = confusablePairs(["#000000", "#FFFFFF"], "deuteranopia");
    expect(pairs).toHaveLength(0);
  });
});
