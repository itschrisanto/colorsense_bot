import { InputFile, type Context } from "grammy";
import { fetchPalettes } from "../lib/colorsenseClient.js";
import { renderPaletteImage } from "../render/paletteImage.js";
import { setActivePalette } from "../lib/activePalette.js";

const UNREACHABLE_MESSAGE = "ColorSense isn't responding right now — try again in a moment.";

/** Pulls one real, named palette from ColorSense's trending library and
 * renders it with the same template every other palette output uses.
 * Reused by both natural-language routing and an active Lauma
 * conversation — "give me a sample swatch" always returns a real, on-brand
 * ColorSense palette, never one invented by the model. */
export async function sendSamplePalette(ctx: Context): Promise<void> {
  let data;
  try {
    data = await fetchPalettes({ category: "trending", limit: 8 });
  } catch (err) {
    console.error("Sample palette fetch failed:", err);
    await ctx.reply(UNREACHABLE_MESSAGE);
    return;
  }

  if (data.items.length === 0) {
    await ctx.reply(UNREACHABLE_MESSAGE);
    return;
  }

  const palette = data.items[Math.floor(Math.random() * data.items.length)]!;
  if (ctx.chat) setActivePalette(ctx.chat.id, palette.colors);

  const image = await renderPaletteImage(palette.colors);
  await ctx.replyWithPhoto(new InputFile(image, "sample-palette.png"), {
    caption: `"${palette.name}" — one of ColorSense's trending palettes.`,
  });
}
