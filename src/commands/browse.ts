import { InlineKeyboard, InputFile, InputMediaBuilder, type Bot, type Context } from "grammy";
import { fetchPalettes, type PaletteCategory } from "../lib/colorsenseClient.js";
import { renderPaletteGridImage } from "../render/paletteGridImage.js";

const PAGE_LIMIT = 8;
const UNREACHABLE_MESSAGE = "ColorSense isn't responding right now — try again in a moment.";
const PALETTE_LIBRARY_URL = "https://colorsense.online/palettes/";
export const SEARCH_USAGE = "What should I search for? Try <code>/search sunset</code>";

const CATEGORIES: { id: PaletteCategory; label: string }[] = [
  { id: "trending", label: "Trending" },
  { id: "premade", label: "Premade" },
  { id: "generated", label: "Generated" },
  { id: "user", label: "Community" },
];

function browseKeyboard(category: PaletteCategory, page: number, totalPages: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (page > 1) kb.text("◀️ Prev", `pal:${category}:${page - 1}`);
  if (page < totalPages) kb.text("▶️ Next", `pal:${category}:${page + 1}`);
  kb.row();
  for (const c of CATEGORIES) {
    kb.text(c.id === category ? `• ${c.label}` : c.label, `pal:${c.id}:1`);
  }
  kb.row();
  kb.url("Browse full Palette Library", PALETTE_LIBRARY_URL);
  return kb;
}

function searchKeyboard(query: string, page: number, totalPages: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  const truncated = query.slice(0, 40);
  if (page > 1) kb.text("◀️ Prev", `srch:${page - 1}:${truncated}`);
  if (page < totalPages) kb.text("▶️ Next", `srch:${page + 1}:${truncated}`);
  kb.row();
  kb.url("Browse full Palette Library", PALETTE_LIBRARY_URL);
  return kb;
}

/** Sends a fresh photo message, or edits the existing one in place when `edit` is true (button taps). */
async function sendOrEditPhoto(
  ctx: Context,
  edit: boolean,
  image: Buffer,
  filename: string,
  caption: string,
  reply_markup: InlineKeyboard,
): Promise<void> {
  if (edit) {
    const media = InputMediaBuilder.photo(new InputFile(image, filename), { caption });
    await ctx.editMessageMedia(media, { reply_markup });
  } else {
    await ctx.replyWithPhoto(new InputFile(image, filename), { caption, reply_markup });
  }
}

export async function showBrowsePage(ctx: Context, category: PaletteCategory, page: number, edit: boolean): Promise<void> {
  try {
    const data = await fetchPalettes({ category, page, limit: PAGE_LIMIT });
    const totalPages = Math.max(1, data.totalPages);
    const label = CATEGORIES.find((c) => c.id === category)?.label ?? category;
    const caption = `${label} — page ${data.page}/${totalPages}`;
    const reply_markup = browseKeyboard(category, data.page, totalPages);

    if (data.items.length === 0) {
      // No image to edit into — fall back to a fresh text message for this edge case.
      await ctx.reply(`${caption}\n\nNothing here yet.`, { reply_markup });
      return;
    }

    const image = await renderPaletteGridImage(data.items.map((p) => ({ name: p.name, colors: p.colors })));
    await sendOrEditPhoto(ctx, edit, image, "palettes.png", caption, reply_markup);
  } catch (err) {
    console.error("Palette browse failed:", err);
    await ctx.reply(UNREACHABLE_MESSAGE);
  }
}

export async function showSearchPage(ctx: Context, query: string, page: number, edit: boolean): Promise<void> {
  try {
    const data = await fetchPalettes({ category: "all", q: query, page, limit: PAGE_LIMIT });
    const totalPages = Math.max(1, data.totalPages);
    const caption = `Search: ${query} — page ${data.page}/${totalPages}`;

    if (data.items.length === 0) {
      const kb = new InlineKeyboard().url("Browse full Palette Library", PALETTE_LIBRARY_URL);
      await ctx.reply(`${caption}\n\nCouldn't find anything for “${query}”. Try a different word?`, { reply_markup: kb });
      return;
    }

    const image = await renderPaletteGridImage(data.items.map((p) => ({ name: p.name, colors: p.colors })));
    const reply_markup = searchKeyboard(query, data.page, totalPages);
    await sendOrEditPhoto(ctx, edit, image, "search.png", caption, reply_markup);
  } catch (err) {
    console.error("Palette search failed:", err);
    await ctx.reply(UNREACHABLE_MESSAGE);
  }
}

export function registerBrowseCommands(bot: Bot): void {
  bot.command("trending", async (ctx) => {
    await showBrowsePage(ctx, "trending", 1, false);
  });

  bot.command("search", async (ctx) => {
    const query = (ctx.match ?? "").toString().trim();
    if (!query) {
      await ctx.reply(SEARCH_USAGE, { parse_mode: "HTML" });
      return;
    }
    await showSearchPage(ctx, query, 1, false);
  });

  bot.on("callback_query:data", async (ctx, next) => {
    const data = ctx.callbackQuery.data;
    const parts = data.split(":");
    const tag = parts[0];

    if (tag === "pal") {
      const category = parts[1] as PaletteCategory;
      const page = Number(parts[2]);
      await ctx.answerCallbackQuery();
      await showBrowsePage(ctx, category, page, true);
      return;
    }

    if (tag === "srch") {
      const page = Number(parts[1]);
      const query = parts.slice(2).join(":");
      await ctx.answerCallbackQuery();
      await showSearchPage(ctx, query, page, true);
      return;
    }

    await next();
  });
}
