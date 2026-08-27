import type { Bot } from "grammy";
import { ADMIN_CHAT_ID } from "../config.js";
import { getStatsSummary } from "../middleware/stats.js";

// Deliberately not registered in setMyCommands — an unlisted, admin-only
// command, same pattern as BoringPH's own /status.
export function registerStatusCommand(bot: Bot): void {
  bot.command("status", async (ctx) => {
    if (String(ctx.chat.id) !== ADMIN_CHAT_ID) return;
    await ctx.reply(await getStatsSummary());
  });
}
