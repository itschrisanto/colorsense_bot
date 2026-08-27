import { InlineKeyboard, type Bot, type Context } from "grammy";
import { ADMIN_CHAT_ID } from "../config.js";
import { getStatsSummary, getRecentErrorsSummary, getPopularFeaturesSummary } from "../middleware/stats.js";
import { getCacheSize, clearCache, pingApi } from "../lib/colorsenseClient.js";
import { testerRegistry, MAX_TESTERS } from "../lib/registry.js";
import { supabase } from "../lib/supabase.js";

// Admin-only, unlisted — same pattern as /status. Curated for what this bot
// actually has to manage: no accounts, no invites — just the tester cap,
// the live API dependency, the palette cache, and request/error visibility.

const ADMIN_TEXT = "Admin tools.";

const ACTIONS = {
  status: "admin:status",
  ping: "admin:ping",
  errors: "admin:errors",
  cacheInfo: "admin:cache_info",
  cacheClear: "admin:cache_clear",
  testers: "admin:testers",
  popular: "admin:popular",
  feedback: "admin:feedback",
} as const;

async function getRecentFeedbackSummary(): Promise<string> {
  const { data, error } = await supabase
    .from("feedback")
    .select("who, message, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Failed to query recent feedback:", error.message);
    return "Couldn't load feedback right now.";
  }
  if (!data || data.length === 0) return "No feedback recorded yet.";
  return data.map((row) => `${row.created_at} — ${row.who}: ${row.message}`).join("\n\n");
}

function isAdmin(ctx: Context): boolean {
  return ctx.chat !== undefined && String(ctx.chat.id) === ADMIN_CHAT_ID;
}

function adminKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("View Bot Status", ACTIONS.status).row()
    .text("Popular Features", ACTIONS.popular).row()
    .text("Tester Count", ACTIONS.testers).row()
    .text("Recent Feedback", ACTIONS.feedback).row()
    .text("Ping ColorSense API", ACTIONS.ping).row()
    .text("View Recent Errors", ACTIONS.errors).row()
    .text("Cache Info", ACTIONS.cacheInfo).row()
    .text("Clear Cache", ACTIONS.cacheClear);
}

export function registerAdminCommand(bot: Bot): void {
  bot.command("admin", async (ctx) => {
    if (!isAdmin(ctx)) return;
    await ctx.reply(ADMIN_TEXT, { reply_markup: adminKeyboard() });
  });

  bot.on("callback_query:data", async (ctx, next) => {
    const data = ctx.callbackQuery.data;
    if (!Object.values(ACTIONS).includes(data as (typeof ACTIONS)[keyof typeof ACTIONS])) {
      await next();
      return;
    }

    if (!isAdmin(ctx)) {
      await ctx.answerCallbackQuery();
      return;
    }

    await ctx.answerCallbackQuery();

    switch (data) {
      case ACTIONS.status:
        await ctx.reply(await getStatsSummary());
        return;
      case ACTIONS.popular:
        await ctx.reply(await getPopularFeaturesSummary());
        return;
      case ACTIONS.testers:
        await ctx.reply(`Testers: ${testerRegistry.count()}/${MAX_TESTERS}`);
        return;
      case ACTIONS.feedback:
        await ctx.reply(await getRecentFeedbackSummary());
        return;
      case ACTIONS.ping: {
        const result = await pingApi();
        const icon = result.ok ? "✅" : "❌";
        await ctx.reply(`${icon} ColorSense API — ${result.detail} (${result.latencyMs}ms)`);
        return;
      }
      case ACTIONS.errors:
        await ctx.reply(getRecentErrorsSummary());
        return;
      case ACTIONS.cacheInfo:
        await ctx.reply(`Palette cache: ${getCacheSize()} entries`);
        return;
      case ACTIONS.cacheClear:
        clearCache();
        await ctx.reply("Cache cleared.");
        return;
    }
  });
}
