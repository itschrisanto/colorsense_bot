import { InlineKeyboard, InputFile, type Bot, type Context } from "grammy";
import { isValidHex, normalizeHex, hexToRgb } from "../lib/wcagContrast.js";
import { getHarmonyColors, HARMONY_LABELS, type Harmony } from "../lib/harmony.js";
import { renderPaletteImage } from "../render/paletteImage.js";
import { nameColor } from "../lib/colorNames.js";
import { setActivePalette } from "../lib/activePalette.js";

const HARMONY_IDS = Object.keys(HARMONY_LABELS) as Harmony[];
const PRESET_CALLBACK_PREFIX = "hbase";

// A varied starting-point spread (warm/cool/neutral/vibrant) for anyone who
// doesn't already have a hex code in mind. Labels are generated from the same
// named-color database used for photo extraction, so they stay consistent
// with the rest of the bot without hardcoding names here.
const PRESET_COLORS = [
  "#E63946",
  "#F4A261",
  "#E9C46A",
  "#8AC926",
  "#2A9D8F",
  "#457B9D",
  "#264653",
  "#6D597A",
  "#B5838D",
  "#1D3557",
];

function harmonyKeyboard(hex: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  HARMONY_IDS.forEach((id, i) => {
    kb.text(HARMONY_LABELS[id], `harmony:${hex}:${id}`);
    if (i % 2 === 1) kb.row();
  });
  return kb;
}

function presetKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  PRESET_COLORS.forEach((hex, i) => {
    const [r, g, b] = hexToRgb(hex);
    kb.text(nameColor(r, g, b), `${PRESET_CALLBACK_PREFIX}:${hex}`);
    if (i % 2 === 1) kb.row();
  });
  return kb;
}

export async function promptHarmonyTypes(ctx: Context, hex: string): Promise<void> {
  await ctx.reply(`Okay, <code>${hex}</code> — which direction should we take it?`, {
    parse_mode: "HTML",
    reply_markup: harmonyKeyboard(hex),
  });
}

export async function promptColorPresets(ctx: Context): Promise<void> {
  await ctx.reply(
    "Pick a color to start with, or hand me an exact one — <code>/harmony #1F5313</code> works too:",
    { parse_mode: "HTML", reply_markup: presetKeyboard() },
  );
}

export function registerHarmonyCommand(bot: Bot): void {
  bot.command("harmony", async (ctx) => {
    const arg = (ctx.match ?? "").toString().trim();

    if (!isValidHex(arg)) {
      await promptColorPresets(ctx);
      return;
    }

    await promptHarmonyTypes(ctx, normalizeHex(arg));
  });

  bot.on("callback_query:data", async (ctx, next) => {
    const data = ctx.callbackQuery.data;
    const [tag, hex, harmony] = data.split(":");

    if (tag === PRESET_CALLBACK_PREFIX && hex) {
      await ctx.answerCallbackQuery();
      await promptHarmonyTypes(ctx, hex);
      return;
    }

    if (tag !== "harmony" || !hex || !harmony || !HARMONY_IDS.includes(harmony as Harmony)) {
      await next();
      return;
    }

    await ctx.answerCallbackQuery();
    const colors = getHarmonyColors(hex, harmony as Harmony);
    if (ctx.chat) setActivePalette(ctx.chat.id, colors);

    const image = await renderPaletteImage(colors);
    await ctx.replyWithPhoto(new InputFile(image, "harmony.png"), {
      caption: `${HARMONY_LABELS[harmony as Harmony]}, starting from ${hex}.`,
    });
  });
}
