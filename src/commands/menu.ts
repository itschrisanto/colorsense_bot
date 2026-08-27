import { Keyboard, type Bot } from "grammy";
import { showBrowsePage, SEARCH_USAGE } from "./browse.js";
import { sendFaq } from "./faq.js";
import { promptColorPresets } from "./harmony.js";
import { HEALTH_USAGE } from "./health.js";

export const MENU_LABELS = {
  harmony: "Build a Color Scheme",
  health: "Score a Palette",
  trending: "Browse Trending",
  search: "Search Palettes",
  photo: "Extract from Photo",
  faq: "How to Use",
} as const;

export const MAIN_MENU = new Keyboard()
  .text(MENU_LABELS.harmony).text(MENU_LABELS.health).row()
  .text(MENU_LABELS.trending).text(MENU_LABELS.search).row()
  .text(MENU_LABELS.photo).text(MENU_LABELS.faq)
  .resized();

export function registerMenu(bot: Bot): void {
  bot.hears(MENU_LABELS.harmony, promptColorPresets);

  bot.hears(MENU_LABELS.health, async (ctx) => {
    await ctx.reply(HEALTH_USAGE, { parse_mode: "HTML" });
  });

  bot.hears(MENU_LABELS.search, async (ctx) => {
    await ctx.reply(SEARCH_USAGE, { parse_mode: "HTML" });
  });

  bot.hears(MENU_LABELS.photo, async (ctx) => {
    await ctx.reply("Send me a photo and I'll pull the colors out of it.");
  });

  bot.hears(MENU_LABELS.trending, async (ctx) => {
    await showBrowsePage(ctx, "trending", 1, false);
  });

  bot.hears(MENU_LABELS.faq, sendFaq);
}
