import { InlineKeyboard, type Context } from "grammy";
import { recordUsageEvent } from "../middleware/stats.js";

export const APP_STORE_URL =
  "https://apps.apple.com/app/apple-store/id6809134374?pt=129417463&ct=Telegram%20ColorSense%20Bot&mt=8";

export function appStoreKeyboard(): InlineKeyboard {
  // Telegram URL buttons only support text, not Apple's graphical badge.
  return new InlineKeyboard().url("Download on the App Store", APP_STORE_URL);
}

/** Shown in place of a retired tool's real behavior. `feature` is recorded as
 * a `gate:<feature>` usage event — Telegram doesn't report URL-button taps
 * back to the bot, so this measures how often people still reach for a cut
 * feature, not confirmed App Store visits. */
export async function sendAppDownloadPrompt(ctx: Context, feature: string): Promise<void> {
  recordUsageEvent(ctx.chat?.id, `gate:${feature}`, 0, false);
  await ctx.reply(
    "That feature is now in the ColorSense iOS app. Download it on the App Store to keep going.",
    { reply_markup: appStoreKeyboard() },
  );
}
