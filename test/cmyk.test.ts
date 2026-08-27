import { describe, expect, it } from "vitest";
import { hexToCmyk, mayShiftInPrint } from "../src/lib/cmyk.js";

describe("hexToCmyk", () => {
  it("converts pure black to 0/0/0/100", () => {
    expect(hexToCmyk("#000000")).toEqual({ c: 0, m: 0, y: 0, k: 100 });
  });

  it("converts pure white to 0/0/0/0", () => {
    expect(hexToCmyk("#FFFFFF")).toEqual({ c: 0, m: 0, y: 0, k: 0 });
  });

  it("converts pure red to 0/100/100/0", () => {
    expect(hexToCmyk("#FF0000")).toEqual({ c: 0, m: 100, y: 100, k: 0 });
  });
});

describe("mayShiftInPrint", () => {
  it("flags a vivid, bright color as likely to shift", () => {
    expect(mayShiftInPrint("#FF0000")).toBe(true);
  });

  it("does not flag a muted, dark color", () => {
    expect(mayShiftInPrint("#212B3B")).toBe(false);
  });
});
