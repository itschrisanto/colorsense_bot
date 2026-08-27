import type { Bot, Context } from "grammy";

export const FAQ_TEXT = [
  "Here's what I can do.",
  "",
  "/harmony #1F5313",
  "Give me a base color and I'll build a full scheme around it — Complementary, Monochromatic, Analogous, Split-comp., Triadic, or Tetradic. No hex in mind? Type /harmony on its own and I'll give you a few starting colors.",
  "",
  "/health #264653 #F4A261 #2A9D8F",
  "Send me two or more colors and I'll score the palette on contrast, harmony, balance, vibrancy, and completeness, with a few thoughts on how to improve it.",
  "",
  "Send a photo",
  "No command needed. Send me any image and I'll pull out its dominant colors, named and ready to use.",
  "",
  "/trending",
  "A look at what's trending in the ColorSense library. Use the buttons to page through results or switch categories.",
  "",
  "/search sunset",
  "Search the ColorSense library by name.",
  "",
  "/contrast",
  "WCAG contrast checking lives on the Pro side of ColorSense — I'll point you to the pricing page.",
].join("\n");

export async function sendFaq(ctx: Context): Promise<void> {
  await ctx.reply(FAQ_TEXT);
}

export function registerFaqCommand(bot: Bot): void {
  bot.command(["faq", "help"], sendFaq);
}
