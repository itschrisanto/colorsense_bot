import { Keyboard, type Bot } from "grammy";
import { sendFaq } from "./faq.js";
import { sendAppDownloadPrompt } from "../lib/waitlist.js";

export const MENU_LABELS = {
  photo: "Extract from Photo",
  faq: "How to Use",
} as const;

// Buttons from the pre-iOS-app six-button menu. No longer sent to anyone,
// but a Telegram client that already rendered the old keyboard can keep
// showing it until the user's next /start — these keep an old tap from
// falling through to natural-language routing with a confusing result.
const RETIRED_LABELS = ["Build a Color Scheme", "Score a Palette", "Browse Trending", "Search Palettes"];

export const MAIN_MENU = new Keyboard()
  .text(MENU_LABELS.photo).text(MENU_LABELS.faq)
  .resized();

export function registerMenu(bot: Bot): void {
  bot.hears(MENU_LABELS.photo, async (ctx) => {
    await ctx.reply("Send me a photo and I'll pull the colors out of it.");
  });

  bot.hears(MENU_LABELS.faq, sendFaq);

  bot.hears(RETIRED_LABELS, async (ctx) => {
    await sendAppDownloadPrompt(ctx, "menu_button");
  });
}
