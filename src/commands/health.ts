import { InlineKeyboard, InputFile, type Bot, type Context } from "grammy";
import { isValidHex, normalizeHex, hexToRgb } from "../lib/wcagContrast.js";
import { scorePalette } from "../lib/paletteHealth.js";
import { nameColor } from "../lib/colorNames.js";
import { buildContrastRows, computeHierarchy, buildSummary, type Entry } from "../lib/paletteHealthReport.js";
import { renderHealthImage } from "../render/healthImage.js";
import { renderContrastTableImage } from "../render/contrastTableImage.js";
import { renderDesignGuidanceImage } from "../render/designGuidanceImage.js";
import { proFeatureKeyboard, TELEGRAM_BOT_PAGE_URL } from "../lib/pricing.js";
import { setActivePalette } from "../lib/activePalette.js";
import { getPaletteFixUsage } from "../lib/accountLink.js";

export const HEALTH_USAGE = "Send me two or more colors and I'll score the palette — try <code>/health #264653 #F4A261 #2A9D8F</code>";
const FIX_IT_CALLBACK = "health:fixit";

// Deuteranopia is the most common form (~6% of men) and the website's own
// default — the bot has no UI for picking a different type, so this one
// covers the majority case rather than adding a selector for v1.
const CB_TYPE = "deuteranopia" as const;

/** Scores a palette and replies with the full ColorSense-style Palette
 * Health report — score card, contrast table, and design guidance, each a
 * rendered image, matching the web app's own layout instead of a wall of
 * text. Shared by the /health command and natural-language routing. */
export async function runHealthCheck(ctx: Context, hexes: string[]): Promise<void> {
  if (ctx.chat) setActivePalette(ctx.chat.id, hexes);

  const entries: Entry[] = hexes.map((hex) => ({ hex, name: nameColor(...hexToRgb(hex)) }));
  const result = scorePalette(hexes);
  const contrastRows = buildContrastRows(entries);
  const hierarchy = computeHierarchy(entries);
  const summary = buildSummary(contrastRows, entries, result.overall, CB_TYPE);

  const scoreImage = await renderHealthImage(hexes, result, summary.text);
  await ctx.replyWithPhoto(new InputFile(scoreImage, "palette-health.png"));

  const contrastImage = await renderContrastTableImage(contrastRows);
  await ctx.replyWithPhoto(new InputFile(contrastImage, "contrast-table.png"));

  const guidanceImage = await renderDesignGuidanceImage(hierarchy, entries);
  const reply_markup = new InlineKeyboard().text("Fix It", FIX_IT_CALLBACK);
  await ctx.replyWithPhoto(new InputFile(guidanceImage, "design-guidance.png"), { reply_markup });
}

export function registerHealthCommand(bot: Bot): void {
  bot.command("health", async (ctx) => {
    const args = (ctx.match ?? "").toString().trim().split(/\s+/).filter(Boolean);

    if (args.length < 2 || !args.every(isValidHex)) {
      await ctx.reply(HEALTH_USAGE, { parse_mode: "HTML" });
      return;
    }

    await runHealthCheck(ctx, args.map(normalizeHex));
  });

  bot.on("callback_query:data", async (ctx, next) => {
    if (ctx.callbackQuery.data !== FIX_IT_CALLBACK) {
      await next();
      return;
    }
    await ctx.answerCallbackQuery();

    if (!ctx.chat) return;
    const usage = await getPaletteFixUsage(ctx.chat.id);
    const openColorSense = new InlineKeyboard().url("Open ColorSense", "https://colorsense.online");

    if (usage === null) {
      await ctx.reply(
        `Connect your ColorSense account to see your real fix usage — get a code at ${TELEGRAM_BOT_PAGE_URL}, then send /link CODE.`,
      );
      return;
    }

    if (usage.unlimited) {
      await ctx.reply("Unlimited free fixes on your account. Head to colorsense.online to use one.", {
        reply_markup: openColorSense,
      });
      return;
    }

    if ((usage.remaining ?? 0) > 0) {
      await ctx.reply(
        `You have ${usage.remaining} of ${usage.limit} free fixes left. Head to colorsense.online to use one.`,
        { reply_markup: openColorSense },
      );
      return;
    }

    await ctx.reply(`You've used all ${usage.limit} free fixes. Upgrade to Pro for unlimited.`, {
      reply_markup: proFeatureKeyboard(),
    });
  });
}
