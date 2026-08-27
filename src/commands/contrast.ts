import type { Bot, Context } from "grammy";
import { proFeatureMessage, proFeatureKeyboard } from "../lib/pricing.js";

export async function sendContrastRedirect(ctx: Context): Promise<void> {
  await ctx.reply(proFeatureMessage("WCAG contrast checking"), { reply_markup: proFeatureKeyboard() });
}

export function registerContrastCommand(bot: Bot): void {
  bot.command("contrast", sendContrastRedirect);
}
