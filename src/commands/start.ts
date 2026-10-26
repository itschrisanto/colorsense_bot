import type { Bot, Context } from "grammy";
import { MAIN_MENU } from "./menu.js";

const WELCOME_TEXT = [
  "Hi, I'm Lauma — ColorSense's color assistant.",
  "",
  "Send me a photo and I'll pull its dominant colors out as a named swatch, ready to use.",
  "",
  "For schemes, contrast checks, and everything else, download the ColorSense iOS app from the App Store.",
  "",
  "Type /faq for the full rundown.",
].join("\n");

export async function sendWelcome(ctx: Context): Promise<void> {
  await ctx.reply(WELCOME_TEXT, { reply_markup: MAIN_MENU });
}

export function registerStartCommand(bot: Bot): void {
  bot.command("start", sendWelcome);
}
