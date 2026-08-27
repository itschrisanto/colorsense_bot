import type { Bot } from "grammy";
import { ADMIN_CHAT_ID } from "../config.js";

export const OFFICIAL_CONTACT_EMAIL = "hello@colorsense.online";

const USAGE = [
  "What's on your mind? Try <code>/feedback the harmony buttons were confusing</code>",
  `Prefer email? <a href="mailto:${OFFICIAL_CONTACT_EMAIL}">${OFFICIAL_CONTACT_EMAIL}</a> reaches the ColorSense team directly.`,
].join("\n\n");

export function registerFeedbackCommand(bot: Bot): void {
  bot.command("feedback", async (ctx) => {
    const message = (ctx.match ?? "").toString().trim();
    if (!message) {
      await ctx.reply(USAGE, { parse_mode: "HTML" });
      return;
    }

    const from = ctx.from;
    const name = from ? `${from.first_name ?? ""} ${from.last_name ?? ""}`.trim() : "";
    const who = name || from?.username || `chat ${ctx.chat?.id}`;

    try {
      await ctx.api.sendMessage(ADMIN_CHAT_ID, `Feedback from ${who} (chat ${ctx.chat?.id}):\n${message}`);
      await ctx.reply(
        `Got it, thanks — I'll pass this along. You can also always reach us at <a href="mailto:${OFFICIAL_CONTACT_EMAIL}">${OFFICIAL_CONTACT_EMAIL}</a>.`,
        { parse_mode: "HTML" },
      );
    } catch (err) {
      console.error("Failed to forward feedback:", err);
      await ctx.reply(
        `That didn't go through — mind trying again in a moment? Or email us directly at <a href="mailto:${OFFICIAL_CONTACT_EMAIL}">${OFFICIAL_CONTACT_EMAIL}</a>.`,
        { parse_mode: "HTML" },
      );
    }
  });
}
