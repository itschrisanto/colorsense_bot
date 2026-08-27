import type { Bot } from "grammy";

const PRIVACY_TEXT = [
  "Quick privacy note.",
  "",
  "Photos you send are processed in memory to pull out colors, then discarded — I don't save them anywhere.",
  "Colors and palettes you mention are kept briefly (up to an hour) so follow-ups like \"score that\" work, then forgotten.",
  "Nothing you send goes to any AI service — every response here is plain computation, not a language model.",
  "Feedback sent via /feedback is forwarded to the ColorSense team so it can be acted on.",
  "Basic, anonymous usage stats (which commands get used, how often things fail) are kept to keep the bot running well — no message content, no personal details.",
].join("\n");

export function registerPrivacyCommand(bot: Bot): void {
  bot.command("privacy", async (ctx) => {
    await ctx.reply(PRIVACY_TEXT);
  });
}
