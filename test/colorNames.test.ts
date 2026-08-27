import { describe, expect, it } from "vitest";
import { nameColor } from "../src/lib/colorNames.js";

describe("nameColor", () => {
  it("names pure black and white correctly", () => {
    expect(nameColor(0, 0, 0)).toBe("Black");
    expect(nameColor(255, 255, 255)).toBe("White");
  });

  it("names pure red", () => {
    expect(nameColor(255, 0, 0)).toBe("Red");
  });

  it("always returns a name, never throws, for an arbitrary color", () => {
    expect(nameColor(123, 45, 200)).toBeTypeOf("string");
  });
});
