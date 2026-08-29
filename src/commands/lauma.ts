import { InputFile, type Bot, type Context } from "grammy";
import { TELEGRAM_LINK_API_KEY } from "../config.js";
import { sendLaumaMessage, type LaumaResult, type LaumaTurn } from "../lib/laumaChat.js";
import { isLaumaActive, startLaumaSession, endLaumaSession, getLaumaHistory, appendLaumaTurn } from "../lib/laumaSession.js";
import { proFeatureKeyboard, TELEGRAM_BOT_PAGE_URL } from "../lib/pricing.js";
import { detectIntent, dispatchIntent, extractHexCodes } from "./naturalLanguage.js";
import { getActivePalette, setActivePalette } from "../lib/activePalette.js";
import { renderPaletteImage } from "../render/paletteImage.js";

const NOT_CONFIGURED_MESSAGE = "Lauma Chat isn't available yet — check back soon.";
const WELCOME_MESSAGE =
  'You\'re chatting with Lauma — ask about color, palettes, contrast, or ColorSense. Say "bye" or /endlauma to stop.';

// A real conversation ends on a word, not a slash command — matches how
// people actually leave a chat, so /endlauma stays as a backup, not the
// only way out.
const EXIT_WORDS = new Set(["bye", "goodbye", "stop", "exit", "quit", "end"]);

// Well under whatever the API enforces — this is just a fast, friendly
// rejection instead of spending a round trip on an obviously-too-long message.
const MAX_MESSAGE_LENGTH = 1500;

// Sent instead of the user's literal text when a swatch request follows a
// real color discussion — asks Gemini for actual replacement hexes instead
// of prose, so the reply can be parsed and rendered as a real swatch image
// grounded in what was just discussed, not a random unrelated library pull.
const CONTEXTUAL_FIX_PROMPT =
  "Suggest a corrected palette of 4 to 5 real hex colors (format like #RRGGBB) that fixes what we've been discussing. Include the hex codes directly in your reply.";

function recentHexesFromHistory(history: LaumaTurn[]): string[] {
  return extractHexCodes(history.map((turn) => turn.text).join(" "));
}

async function sendContextualFix(ctx: Context, chatId: number, text: string, history: LaumaTurn[]): Promise<void> {
  await ctx.replyWithChatAction("typing").catch(() => undefined);

  const result = await sendLaumaMessage(chatId, CONTEXTUAL_FIX_PROMPT, history);

  if (!result.ok) {
    endLaumaSession(chatId);
    const reply_markup = result.reason === "pro_required" ? proFeatureKeyboard() : undefined;
    await ctx.reply(failureMessage(result), { reply_markup });
    return;
  }

  // History keeps what the user actually said, not the crafted prompt sent
  // in its place — otherwise Lauma's own memory of the conversation drifts
  // from what the person believes they said.
  appendLaumaTurn(chatId, { role: "user", text });
  appendLaumaTurn(chatId, { role: "model", text: result.reply });

  const hexes = extractHexCodes(result.reply);
  if (hexes.length < 2) {
    // Gemini didn't comply with the requested format — her prose reply is
    // still a real, grounded answer, just not one that renders as an image.
    await ctx.reply(result.reply);
    return;
  }

  const palette = hexes.slice(0, 5);
  setActivePalette(chatId, palette);
  const image = await renderPaletteImage(palette);
  await ctx.replyWithPhoto(new InputFile(image, "lauma-fix.png"), { caption: result.reply.slice(0, 1024) });
}

function failureMessage(result: Extract<LaumaResult, { ok: false }>): string {
  switch (result.reason) {
    case "not_linked":
      return `Chatting with Lauma needs your ColorSense account linked — get a code at ${TELEGRAM_BOT_PAGE_URL}, then send /link CODE.`;
    case "pro_required":
      return "Lauma Chat is included with Pro, with a generous daily allowance.";
    case "fair_use_cap": {
      const time = result.resetAtUtc ? result.resetAtUtc.slice(11, 16) : null;
      return `You've hit today's Lauma Chat fair-use limit — it resets ${time ? `at ${time} UTC` : "tomorrow"}.`;
    }
    case "unavailable":
      return "Lauma's having trouble responding right now — try again in a bit.";
  }
}

async function handleLaumaMessage(ctx: Context, text: string): Promise<void> {
  if (!ctx.chat) return;
  const chatId = ctx.chat.id;

  if (text.length > MAX_MESSAGE_LENGTH) {
    await ctx.reply("That's a bit long for a chat message — could you shorten it?");
    return;
  }

  const history = getLaumaHistory(chatId);

  // Hybrid dispatch: anything that maps to a real, already-built tool
  // (a swatch, a contrast check, a scheme, a score) goes straight to it —
  // same on-brand renderers /health, /harmony, etc. already use, zero
  // Gemini cost. "unknown" and "laumaNudge" both fall through to Gemini
  // instead: an unmatched phrase might still be a fair conversational
  // question, and re-nudging "type /lauma" mid-conversation makes no sense.
  const intent = detectIntent(text, getActivePalette(chatId));

  // A swatch request right after a real color discussion means "show me a
  // fix for that", not "show me anything" — the generic samplePalette tool
  // has no idea what was just discussed, so it'd hand back an unrelated
  // random library palette. Only branches here when the session's own
  // history actually contains colors to ground the request in; a cold-start
  // ask falls through to the normal generic dispatch below.
  if (intent.type === "samplePalette" && recentHexesFromHistory(history).length >= 2) {
    await sendContextualFix(ctx, chatId, text, history);
    return;
  }

  if (intent.type !== "unknown" && intent.type !== "laumaNudge") {
    await dispatchIntent(ctx, intent);
    return;
  }

  await ctx.replyWithChatAction("typing").catch(() => undefined);

  const result = await sendLaumaMessage(chatId, text, history);

  if (!result.ok) {
    endLaumaSession(chatId);
    const reply_markup = result.reason === "pro_required" ? proFeatureKeyboard() : undefined;
    await ctx.reply(failureMessage(result), { reply_markup });
    return;
  }

  appendLaumaTurn(chatId, { role: "user", text });
  appendLaumaTurn(chatId, { role: "model", text: result.reply });
  await ctx.reply(result.reply);
}

export function registerLaumaCommand(bot: Bot): void {
  bot.command("lauma", async (ctx) => {
    if (!TELEGRAM_LINK_API_KEY) {
      await ctx.reply(NOT_CONFIGURED_MESSAGE);
      return;
    }
    if (!ctx.chat) return;

    startLaumaSession(ctx.chat.id);
    await ctx.reply(WELCOME_MESSAGE);
  });

  bot.command("endlauma", async (ctx) => {
    if (!ctx.chat) return;

    if (isLaumaActive(ctx.chat.id)) {
      endLaumaSession(ctx.chat.id);
      await ctx.reply("Ended the chat with Lauma.");
    } else {
      await ctx.reply("You're not currently chatting with Lauma.");
    }
  });

  // Registered ahead of the natural-language router (see index.ts) so an
  // active conversation intercepts every plain-text message for that chat
  // instead of falling through to rule-based intent matching.
  bot.on("message:text", async (ctx, next) => {
    if (!ctx.chat || !isLaumaActive(ctx.chat.id)) {
      await next();
      return;
    }

    const text = ctx.message.text.trim();
    if (EXIT_WORDS.has(text.toLowerCase())) {
      endLaumaSession(ctx.chat.id);
      await ctx.reply("Talk soon!");
      return;
    }

    await handleLaumaMessage(ctx, text);
  });
}
