import type { Bot } from "grammy";
import { TELEGRAM_LINK_API_KEY } from "../config.js";
import { confirmLink } from "../lib/accountLink.js";

export const LINK_USAGE = "Get a code from your ColorSense account settings, then try <code>/link ABC123</code>";
const NOT_CONFIGURED_MESSAGE = "Account linking isn't available yet — check back soon.";
const SUCCESS_MESSAGE = "✅ Linked to your ColorSense account.";
const FAILURE_MESSAGE = "That code didn't work — it may be wrong, expired, or already used. Grab a fresh one from your account settings on colorsense.online.";

export function registerLinkCommand(bot: Bot): void {
  bot.command("link", async (ctx) => {
    if (!TELEGRAM_LINK_API_KEY) {
      await ctx.reply(NOT_CONFIGURED_MESSAGE);
      return;
    }

    const code = (ctx.match ?? "").toString().trim();
    if (!code) {
      await ctx.reply(LINK_USAGE, { parse_mode: "HTML" });
      return;
    }

    if (!ctx.chat) return;

    const ok = await confirmLink(code, ctx.chat.id);
    await ctx.reply(ok ? SUCCESS_MESSAGE : FAILURE_MESSAGE);
  });
}
