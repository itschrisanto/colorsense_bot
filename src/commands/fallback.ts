import type { Bot } from "grammy";

/**
 * Catches any message that isn't text or a photo (stickers, voice notes,
 * documents, videos, etc.) — registered last, so it only ever sees updates
 * that fell through every other handler. Without this, those message types
 * were silently ignored, which reads as "the bot is broken" to a public user.
 */
export function registerFallbackHandler(bot: Bot): void {
  bot.on("message", async (ctx) => {
    await ctx.reply("I work with text and photos right now — type /faq to see what I can do.");
  });
}
