import type { Context, NextFunction } from "grammy";

/**
 * Restricts the bot to private 1:1 chats. Nothing currently enforces this at
 * the Telegram platform level (the bot's "Group Privacy"/join-groups setting
 * in BotFather should also be locked down), so this is the code-level
 * guarantee: the bot stays out of groups/channels even if it's added to one,
 * which is the deliberate scope decision behind the whole scaling design
 * (concurrency, per-chat rate limiting, caching) — that design assumes many
 * independent 1:1 conversations, not shared group traffic.
 */
export async function privateOnly(ctx: Context, next: NextFunction): Promise<void> {
  if (ctx.chat && ctx.chat.type !== "private") {
    await ctx.reply("I'm built for one-on-one chats right now — message me directly instead!");
    return;
  }
  await next();
}
