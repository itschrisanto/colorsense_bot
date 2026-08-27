import type { Bot } from "grammy";
import { MAIN_MENU } from "./menu.js";

const WELCOME_TEXT = [
  "Hi, I'm Lauma — ColorSense's color assistant.",
  "",
  "Tap a button below, or just type a command. I can build color schemes, score a palette, pull colors from a photo, or dig through the ColorSense library.",
  "",
  "Type /faq for the full rundown.",
].join("\n");

export function registerStartCommand(bot: Bot): void {
  bot.command("start", async (ctx) => {
    await ctx.reply(WELCOME_TEXT, { reply_markup: MAIN_MENU });
  });
}
