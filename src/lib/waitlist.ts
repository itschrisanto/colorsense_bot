import { InlineKeyboard, type Context } from "grammy";
import { recordUsageEvent } from "../middleware/stats.js";

export const WAITLIST_URL = "https://colorsense.online/mobile-app";

export function waitlistKeyboard(): InlineKeyboard {
  return new InlineKeyboard().url("📱 Join the iOS Waitlist", WAITLIST_URL);
}

/** Shown in place of a retired tool's real behavior. `feature` is recorded as
 * a `gate:<feature>` usage event — Telegram doesn't report URL-button taps
 * back to the bot, so this measures how often people still reach for a cut
 * feature, not confirmed clicks through to the waitlist page. */
export async function sendWaitlistPrompt(ctx: Context, feature: string): Promise<void> {
  recordUsageEvent(ctx.chat?.id, `gate:${feature}`, 0, false);
  await ctx.reply(
    "That one's moved into the ColorSense iOS app, launching soon. Join the waitlist and I'll let you know the moment it's out.",
    { reply_markup: waitlistKeyboard() },
  );
}
