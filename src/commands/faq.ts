import type { Bot, Context } from "grammy";

export const FAQ_TEXT = [
  "Here's what I can do.",
  "",
  "Send a photo",
  "No command needed. Send me any image and I'll pull out its dominant colors, named and ready to use. Not stored anywhere — see /privacy for details.",
  "",
  "/feedback",
  "Something feel off, or have an idea? Tell me and I'll pass it along.",
  "",
  "Schemes, contrast checks, palette scoring, and browsing the ColorSense library are moving to the ColorSense iOS app, launching soon — I'll point you to the waitlist if you ask for one of those.",
].join("\n");

export async function sendFaq(ctx: Context): Promise<void> {
  await ctx.reply(FAQ_TEXT);
}

export function registerFaqCommand(bot: Bot): void {
  bot.command(["faq", "help"], sendFaq);
}
