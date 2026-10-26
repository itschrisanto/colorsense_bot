import type { Bot, Context } from "grammy";
import { appStoreKeyboard } from "../lib/waitlist.js";

export const FAQ_TEXT = [
  "Here's what I can do.",
  "",
  "Send a photo",
  "No command needed. Send me any image and I'll pull out its dominant colors, named and ready to use. Not stored anywhere — see /privacy for details.",
  "",
  "/feedback",
  "Something feel off, or have an idea? Tell me and I'll pass it along.",
  "",
  "For schemes, contrast checks, palette scoring, and the ColorSense library, get the iOS app below.",
].join("\n");

export async function sendFaq(ctx: Context): Promise<void> {
  await ctx.reply(FAQ_TEXT, { reply_markup: appStoreKeyboard() });
}

export function registerFaqCommand(bot: Bot): void {
  bot.command(["faq", "help"], sendFaq);
}
