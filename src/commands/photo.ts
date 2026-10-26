import { InputFile, type Bot } from "grammy";
import { TELEGRAM_BOT_TOKEN } from "../config.js";
import { extractPalette } from "../lib/extractPalette.js";
import { renderPaletteImage } from "../render/paletteImage.js";
import { retry } from "../lib/retry.js";
import { setActivePalette } from "../lib/activePalette.js";
import { appStoreKeyboard, sendAppDownloadPrompt } from "../lib/waitlist.js";

const MAX_FILE_SIZE_BYTES = 15_000_000;
const DOWNLOAD_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;
// Only still checked for on inbound callback_query taps — see the handler
// below, kept as a graceful landing spot for buttons Telegram already
// delivered to users before the iOS-app pivot.
const CALLBACK_PREFIX = "photo";

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
        caption:
          "Here's your palette. Want to take these colors further? Use the HEX codes above in the ColorSense iOS app to edit, check contrast, and save your palette.",
        reply_markup: appStoreKeyboard(),
      });
    } catch (err) {
      console.error("Photo extraction failed:", err);
      await ctx.reply("That image didn't come through cleanly — try a different one?");
    }
  });

  // Graceful landing spot for `photo:health|harmony|contrastmenu|contrastpair`
  // buttons Telegram already delivered before the iOS-app pivot — without
  // this, a tap on one of those old messages would just spin and time out.
  bot.on("callback_query:data", async (ctx, next) => {
    const [tag] = ctx.callbackQuery.data.split(":");

    if (tag !== CALLBACK_PREFIX) {
      await next();
      return;
    }

    await ctx.answerCallbackQuery();
    await sendAppDownloadPrompt(ctx, "photo_followup");
  });
}
