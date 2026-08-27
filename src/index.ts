import { Bot } from "grammy";
import { run } from "@grammyjs/runner";
import { apiThrottler } from "@grammyjs/transformer-throttler";
import { TELEGRAM_BOT_TOKEN } from "./config.js";
import { privateOnly } from "./middleware/privateOnly.js";
import { consentGate, registerConsentHandler } from "./middleware/consentGate.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { statsMiddleware } from "./middleware/stats.js";
import { registerStartCommand } from "./commands/start.js";
import { registerContrastCommand } from "./commands/contrast.js";
import { registerPhotoHandler } from "./commands/photo.js";
import { registerHarmonyCommand } from "./commands/harmony.js";
import { registerHealthCommand } from "./commands/health.js";
import { registerFaqCommand } from "./commands/faq.js";
import { registerBrowseCommands } from "./commands/browse.js";
import { registerMenu } from "./commands/menu.js";
import { registerStatusCommand } from "./commands/status.js";
import { registerAdminCommand } from "./commands/admin.js";
import { registerFeedbackCommand } from "./commands/feedback.js";
import { registerPrivacyCommand } from "./commands/privacy.js";
import { registerLinkCommand } from "./commands/link.js";
import { registerNaturalLanguage } from "./commands/naturalLanguage.js";
import { registerFallbackHandler } from "./commands/fallback.js";
import { testerRegistry } from "./lib/registry.js";
import { initSentry, captureError } from "./lib/sentry.js";
import { sendAdminMessage } from "./notify.js";

initSentry();

const bot = new Bot(TELEGRAM_BOT_TOKEN);

// Throttles outbound API calls (sendMessage, sendPhoto, etc.) to stay within
// Telegram's own rate limits (~30/sec global, ~1/sec per chat), queuing and
// retrying automatically instead of failing with 429s under load.
bot.api.config.use(apiThrottler());

// Keeps the bot out of groups/channels — the whole scaling design (per-chat
// rate limiting, concurrency) assumes many independent 1:1 conversations,
// not shared group traffic. Registered first, ahead of everything else.
bot.use(privateOnly);

// Gates every interaction behind a first-time disclosure + "I Agree" — the
// admin chat bypasses this entirely.
bot.use(consentGate);

// Caps each chat's incoming request rate — protects shared CPU and the
// production ColorSense API (behind /trending, /search) from a single
// abusive or malfunctioning client.
bot.use(rateLimit);

// Times and tallies every request that gets past the rate limiter, by
// command — surfaced via periodic log lines and the admin-only /status.
bot.use(statsMiddleware);

registerStartCommand(bot);
registerContrastCommand(bot);
registerPhotoHandler(bot);
registerHarmonyCommand(bot);
registerHealthCommand(bot);
registerFaqCommand(bot);
registerBrowseCommands(bot);
registerMenu(bot);
registerStatusCommand(bot);
registerAdminCommand(bot);
registerFeedbackCommand(bot);
registerPrivacyCommand(bot);
registerLinkCommand(bot);
registerConsentHandler(bot);

// Registered last: only fires for text that didn't match a slash command or
// menu button above (grammy auto-passes non-matches through).
registerNaturalLanguage(bot);

// Catches anything else (stickers, voice notes, documents, video) that fell
// through every handler above — a graceful note instead of silence.
registerFallbackHandler(bot);

bot.catch((err) => {
  console.error("Unhandled bot error:", err);
  captureError(err.error);
  void sendAdminMessage(bot, `Bot error: ${err.error}`);
});

async function main(): Promise<void> {
  // Load the tester allowlist from Supabase into memory before accepting any
  // traffic, so the consent-gate check on every message stays a fast,
  // synchronous lookup rather than a per-message network round-trip.
  await testerRegistry.init();

  await bot.init();

  await bot.api.setMyCommands([
    { command: "start", description: "Start or reopen ColorSense Companion" },
    { command: "faq", description: "How to use ColorSense Companion" },
    { command: "harmony", description: "Build a color scheme from a base color" },
    { command: "health", description: "Score a palette's contrast and balance" },
    { command: "trending", description: "Browse trending ColorSense palettes" },
    { command: "search", description: "Search the ColorSense palette library" },
    { command: "contrast", description: "WCAG contrast checking (Pro feature)" },
    { command: "link", description: "Connect your ColorSense account" },
    { command: "feedback", description: "Send feedback or report a problem" },
    { command: "privacy", description: "How your data is handled" },
  ]);

  // run() processes updates concurrently (default up to 500 in flight) instead
  // of the strictly sequential handling of bot.start() — one slow request (e.g.
  // photo processing) no longer blocks every other user's reply.
  run(bot);

  console.log("ColorSense Companion is polling for updates.");
  await sendAdminMessage(bot, `ColorSense Companion started at ${new Date().toISOString()}`);
}

main().catch(async (err) => {
  console.error("Fatal startup error:", err);
  captureError(err);
  await sendAdminMessage(bot, `Fatal startup error: ${err}`);
  process.exit(1);
});
