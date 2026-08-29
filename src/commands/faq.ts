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
  "No command needed. Send me any image and I'll pull out its dominant colors, named and ready to use. Not stored anywhere — see /privacy for details.",
  "",
  "/trending",
  "A look at what's trending in the ColorSense library. Use the buttons to page through results or switch categories.",
  "",
  "/search sunset",
  "Search the ColorSense library by name.",
  "",
  "/contrast #264653 #F4A261",
  "Check the WCAG contrast ratio between two colors — same formulas ColorSense's own site uses.",
  "",
  "/link ABC123",
  "Connect your ColorSense account so Pro-gated features reflect your real status. Get a code at https://colorsense.online/telegram-bot.",
  "",
  "/lauma",
  "Chat naturally with Lauma about color, palettes, or ColorSense — included with Pro, with a generous daily allowance. Needs your account linked first. Say \"bye\" or /endlauma to stop.",
  "",
  "/feedback",
  "Something feel off, or have an idea? Tell me and I'll pass it along.",
  "",
  "You can also just talk to me normally — \"build a scheme with #1F5313\" or \"score this palette\" work too, no slash needed.",
].join("\n");

export async function sendFaq(ctx: Context): Promise<void> {
  await ctx.reply(FAQ_TEXT);
}

export function registerFaqCommand(bot: Bot): void {
  bot.command(["faq", "help"], sendFaq);
}
