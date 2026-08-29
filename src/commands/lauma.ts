import type { Bot, Context } from "grammy";
import { TELEGRAM_LINK_API_KEY } from "../config.js";
import { sendLaumaMessage, type LaumaResult } from "../lib/laumaChat.js";
import { isLaumaActive, startLaumaSession, endLaumaSession, getLaumaHistory, appendLaumaTurn } from "../lib/laumaSession.js";
import { proFeatureKeyboard, TELEGRAM_BOT_PAGE_URL } from "../lib/pricing.js";
import { detectIntent, dispatchIntent } from "./naturalLanguage.js";
import { getActivePalette } from "../lib/activePalette.js";

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

  // Hybrid dispatch: anything that maps to a real, already-built tool
  // (a swatch, a contrast check, a scheme, a score) goes straight to it —
  // same on-brand renderers /health, /harmony, etc. already use, zero
  // Gemini cost. "unknown" and "laumaNudge" both fall through to Gemini
  // instead: an unmatched phrase might still be a fair conversational
  // question, and re-nudging "type /lauma" mid-conversation makes no sense.
  const intent = detectIntent(text, getActivePalette(chatId));
  if (intent.type !== "unknown" && intent.type !== "laumaNudge") {
    await dispatchIntent(ctx, intent);
    return;
  }

  await ctx.replyWithChatAction("typing").catch(() => undefined);

  const history = getLaumaHistory(chatId);
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
