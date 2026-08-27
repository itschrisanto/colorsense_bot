import { InlineKeyboard, InputFile, type Bot, type Context } from "grammy";
import { isValidHex, normalizeHex } from "../lib/wcagContrast.js";
import { scorePalette, type HealthDimension, type PaletteHealthResult } from "../lib/paletteHealth.js";
import { renderPaletteImage } from "../render/paletteImage.js";
import { proFeatureMessage, proFeatureKeyboard } from "../lib/pricing.js";
import { setActivePalette } from "../lib/activePalette.js";

export const HEALTH_USAGE = "Send me two or more colors and I'll score the palette — try <code>/health #264653 #F4A261 #2A9D8F</code>";
const FIX_IT_CALLBACK = "health:fixit";

function dimensionLine(dim: HealthDimension): string {
  return `<b>${dim.label}: ${dim.score}/100</b>\n${dim.detail}\n<i>${dim.tip}</i>`;
}

function gradeIntro(grade: PaletteHealthResult["grade"]): string {
  switch (grade) {
    case "A":
      return "This one's working hard.";
    case "B":
      return "Solid palette overall.";
    case "C":
      return "Decent bones, a few rough edges.";
    case "D":
      return "A few things are holding this back.";
    default:
      return "This one needs some work.";
  }
}

/** Scores a palette and replies with the swatch image + breakdown. Shared by the /health command and natural-language routing. */
export async function runHealthCheck(ctx: Context, hexes: string[]): Promise<void> {
  if (ctx.chat) setActivePalette(ctx.chat.id, hexes);
  const result = scorePalette(hexes);

  const image = await renderPaletteImage(hexes);
  await ctx.replyWithPhoto(new InputFile(image, "palette-health.png"), {
    caption: `${gradeIntro(result.grade)} Grade ${result.grade} — ${result.overall}/100.`,
  });

  const breakdown = "Here's the full breakdown:\n\n" + [
    dimensionLine(result.contrast),
    dimensionLine(result.harmony),
    dimensionLine(result.balance),
    dimensionLine(result.vibrancy),
    dimensionLine(result.completeness),
  ].join("\n\n");

  const reply_markup = new InlineKeyboard().text("Fix It", FIX_IT_CALLBACK);
  await ctx.reply(breakdown, { parse_mode: "HTML", reply_markup });
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
    await ctx.reply(proFeatureMessage("One-click color fixing"), { reply_markup: proFeatureKeyboard() });
  });
}
