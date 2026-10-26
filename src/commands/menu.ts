import { InlineKeyboard, type Bot } from "grammy";
import { sendFaq } from "./faq.js";
import { APP_STORE_URL, sendAppDownloadPrompt } from "../lib/waitlist.js";

export const MENU_LABELS = {
  photo: "Extract from Photo",
  faq: "How to Use",
} as const;

// Buttons from the pre-iOS-app six-button menu. No longer sent to anyone,
// but a Telegram client that already rendered the old keyboard can keep
// showing it until the user's next /start — these keep an old tap from
// falling through to natural-language routing with a confusing result.
const RETIRED_LABELS = ["Build a Color Scheme", "Score a Palette", "Browse Trending", "Search Palettes"];

export const MAIN_MENU = new InlineKeyboard()
  .text(MENU_LABELS.photo, "menu:photo")
  .text(MENU_LABELS.faq, "menu:faq")
  .row()
  .url("Download on the App Store", APP_STORE_URL);

export function registerMenu(bot: Bot): void {
  bot.on("callback_query:data", async (ctx, next) => {
    switch (ctx.callbackQuery.data) {
      case "menu:photo":
        await ctx.answerCallbackQuery();
        await ctx.reply("Send me a photo and I'll pull the colors out of it.");
        return;
      case "menu:faq":
        await ctx.answerCallbackQuery();
        await sendFaq(ctx);
        return;
      default:
        await next();
    }
  });

  // Old reply-keyboard buttons may remain visible in existing Telegram chats.
  bot.hears(MENU_LABELS.photo, async (ctx) => {
    await ctx.reply("Send me a photo and I'll pull the colors out of it.");
  });

  bot.hears(MENU_LABELS.faq, sendFaq);

  bot.hears(RETIRED_LABELS, async (ctx) => {
    await sendAppDownloadPrompt(ctx, "menu_button");
  });
}
