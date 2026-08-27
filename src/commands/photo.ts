import { InlineKeyboard, InputFile, type Bot } from "grammy";
import { TELEGRAM_BOT_TOKEN } from "../config.js";
import { extractPalette } from "../lib/extractPalette.js";
import { renderPaletteImage } from "../render/paletteImage.js";
import { retry } from "../lib/retry.js";
import { setActivePalette } from "../lib/activePalette.js";
import { runHealthCheck } from "./health.js";
import { promptHarmonyTypes } from "./harmony.js";

const MAX_FILE_SIZE_BYTES = 15_000_000;
const DOWNLOAD_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;
const CALLBACK_PREFIX = "photo";

function followUpKeyboard(hexes: string[]): InlineKeyboard {
  return new InlineKeyboard()
    .text("Health Check", `${CALLBACK_PREFIX}:health:${hexes.join(",")}`)
    .text("Build a Scheme", `${CALLBACK_PREFIX}:harmony:${hexes[0]}`);
}

async function downloadWithRetry(url: string): Promise<Buffer> {
  return retry(async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Telegram file download returned ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }, DOWNLOAD_ATTEMPTS, RETRY_DELAY_MS);
}

export function registerPhotoHandler(bot: Bot): void {
  bot.on("message:photo", async (ctx) => {
    const sizes = ctx.message.photo;
    const largest = sizes[sizes.length - 1];
    if (!largest) return;

    if (largest.file_size && largest.file_size > MAX_FILE_SIZE_BYTES) {
      await ctx.reply("That image's a bit big — try a smaller one?");
      return;
    }

    let buffer: Buffer;
    try {
      const file = await ctx.api.getFile(largest.file_id);
      if (!file.file_path) {
        await ctx.reply("Telegram and I had a miscommunication there — try sending that again?");
        return;
      }
      const url = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${file.file_path}`;
      buffer = await downloadWithRetry(url);
    } catch (err) {
      console.error("Photo download failed:", err);
      await ctx.reply("Telegram and I had a miscommunication there — try sending that again?");
      return;
    }

    try {
      const hexes = await extractPalette(buffer, 5);
      if (hexes.length === 0) {
        await ctx.reply("Couldn't find much color to work with in that one — try a different photo?");
        return;
      }

      if (ctx.chat) setActivePalette(ctx.chat.id, hexes);

      const swatchImage = await renderPaletteImage(hexes);
      await ctx.replyWithPhoto(new InputFile(swatchImage, "palette.png"), {
        caption: "Here's what I pulled from that.",
        reply_markup: followUpKeyboard(hexes),
      });
    } catch (err) {
      console.error("Photo extraction failed:", err);
      await ctx.reply("That image didn't come through cleanly — try a different one?");
    }
  });

  bot.on("callback_query:data", async (ctx, next) => {
    const data = ctx.callbackQuery.data;
    const [tag, action, payload] = data.split(":");

    if (tag !== CALLBACK_PREFIX || !payload) {
      await next();
      return;
    }

    await ctx.answerCallbackQuery();

    if (action === "health") {
      await runHealthCheck(ctx, payload.split(","));
      return;
    }

    if (action === "harmony") {
      await promptHarmonyTypes(ctx, payload);
    }
  });
}
