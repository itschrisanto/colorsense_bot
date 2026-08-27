import { InputFile, type Bot, type Context } from "grammy";
import { isValidHex, normalizeHex, evaluate } from "../lib/wcagContrast.js";
import { renderContrastImage } from "../render/contrastImage.js";

export const CONTRAST_USAGE = "Send me two colors and I'll check their contrast — try <code>/contrast #264653 #F4A261</code>";

/** Checks two colors' WCAG contrast and replies with a preview image —
 * sample text, ratio, grade, and a pass/fail badge grid — mirroring
 * ColorSense's own web contrast checker. Shared by the /contrast command
 * and natural-language routing. Pure math, same formulas the web app uses —
 * no quota, no Pro gate, since running it costs nothing either way. */
export async function runContrastCheck(ctx: Context, fg: string, bg: string): Promise<void> {
  const result = evaluate(fg, bg);
  const image = await renderContrastImage(fg, bg, result);
  await ctx.replyWithPhoto(new InputFile(image, "contrast.png"), {
    caption: `<code>${fg}</code> on <code>${bg}</code>`,
    parse_mode: "HTML",
  });
}

export async function sendContrastUsage(ctx: Context): Promise<void> {
  await ctx.reply(CONTRAST_USAGE, { parse_mode: "HTML" });
}

export function registerContrastCommand(bot: Bot): void {
  bot.command("contrast", async (ctx) => {
    const args = (ctx.match ?? "").toString().trim().split(/\s+/).filter(Boolean);

    if (args.length !== 2 || !args.every(isValidHex)) {
      await sendContrastUsage(ctx);
      return;
    }

    await runContrastCheck(ctx, normalizeHex(args[0]!), normalizeHex(args[1]!));
  });
}
