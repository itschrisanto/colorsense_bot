import type { Bot } from "grammy";

const WELCOME_TEXT = [
  "ColorSense Companion",
  "",
  "A quick sidekick for colorsense.online, right here in Telegram.",
  "",
  "Coming soon: browse trending palettes, check WCAG contrast, and pull a palette out of any photo.",
].join("\n");

export function registerStartCommand(bot: Bot): void {
  bot.command(["start", "help"], async (ctx) => {
    await ctx.reply(WELCOME_TEXT);
  });
}
