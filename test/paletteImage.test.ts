import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { renderPaletteImage } from "../src/render/paletteImage.js";

describe("renderPaletteImage", () => {
  it("renders five colors in the iOS share-card dimensions", async () => {
    const image = await renderPaletteImage([
      "#85DEF4",
      "#A0AAB3",
      "#F6F6F4",
      "#10B6EA",
      "#3A4654",
    ]);
    const metadata = await sharp(image).metadata();

    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(1080);
    expect(metadata.height).toBe(1350);
  });

  it("rejects an empty palette", async () => {
    await expect(renderPaletteImage([])).rejects.toThrow("Cannot render an empty palette");
  });
});
