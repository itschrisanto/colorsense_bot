import type { Bot } from "grammy";
import { TELEGRAM_LINK_API_KEY } from "../config.js";
import { confirmLink, type LinkFailureReason } from "../lib/accountLink.js";
import { TELEGRAM_BOT_PAGE_URL, TELEGRAM_CONNECTIONS_URL } from "../lib/pricing.js";

export const LINK_USAGE = `Get a code from ${TELEGRAM_BOT_PAGE_URL}, then try <code>/link ABC123</code>`;
const NOT_CONFIGURED_MESSAGE = "Account linking isn't available yet — check back soon.";
const SUCCESS_MESSAGE = "Linked to your ColorSense account.";

const FAILURE_MESSAGES: Record<LinkFailureReason, string> = {
  not_configured: NOT_CONFIGURED_MESSAGE,
  free_limit: `Your Free ColorSense plan allows 1 linked Telegram account, and it's already in use. Unlink it at ${TELEGRAM_CONNECTIONS_URL}, then try again.`,
  pro_limit: `Your Pro ColorSense plan allows up to 5 linked Telegram accounts, and you're at that limit. Unlink one at ${TELEGRAM_CONNECTIONS_URL}, then try again.`,
  already_linked_elsewhere: `This Telegram account is already linked to a different ColorSense account. Unlink it there first at ${TELEGRAM_CONNECTIONS_URL}, then try again here.`,
  invalid_code: `That code isn't valid — double check it, or grab a fresh one at ${TELEGRAM_BOT_PAGE_URL}.`,
  used_code: `That code has already been used. Grab a fresh one at ${TELEGRAM_BOT_PAGE_URL}.`,
  expired_code: `That code has expired. Grab a fresh one at ${TELEGRAM_BOT_PAGE_URL}.`,
  rate_limited: "Too many attempts — please wait a bit before trying again.",
  unknown: `That code didn't work — it may be wrong, expired, or already used. Grab a fresh one at ${TELEGRAM_BOT_PAGE_URL}.`,
};

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

    const result = await confirmLink(code, ctx.chat.id);
    await ctx.reply(result.ok ? SUCCESS_MESSAGE : FAILURE_MESSAGES[result.reason]);
  });
}
