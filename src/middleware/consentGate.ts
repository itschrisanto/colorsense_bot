import { InlineKeyboard, type Bot, type Context, type NextFunction } from "grammy";
import { ADMIN_CHAT_ID } from "../config.js";
import { testerRegistry, MAX_TESTERS } from "../lib/registry.js";
import { sendWelcome } from "../commands/start.js";

/**
 * Gates every interaction until a first-time chat has agreed to a short
 * disclosure — mirroring BoringPH's own consent-gate pattern. Nothing beyond
 * this gate runs for an unregistered chat except the "I Agree" tap itself.
 * The admin chat bypasses this entirely and is never counted against the
 * public tester cap.
 */

const AGREE_CALLBACK = "consent:agree";
const PRIVACY_POLICY_URL = "https://colorsense.online/privacy-policy";

const DISCLOSURE_TEXT = [
  "Hi, I'm Lauma — ColorSense's color assistant, currently in a limited public test.",
  "",
  `This test is capped at ${MAX_TESTERS} people. Photos you send are processed in memory to pull out colors and are never stored — type /privacy anytime for the full details.`,
  "",
  "Tap I Agree to get started.",
].join("\n");

function fullMessage(): string {
  return `This test is full for now — ${testerRegistry.count()}/${MAX_TESTERS} spots taken. Check back soon, or keep an eye on ColorSense's channels for the wider launch.`;
}

function disclosureKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .url("Read Full Privacy Policy", PRIVACY_POLICY_URL)
    .row()
    .text("I Agree", AGREE_CALLBACK);
}

function isAdminChat(chatId: number): boolean {
  return String(chatId) === ADMIN_CHAT_ID;
}

export async function consentGate(ctx: Context, next: NextFunction): Promise<void> {
  const chatId = ctx.chat?.id;
  if (chatId === undefined) {
    await next();
    return;
  }

  if (isAdminChat(chatId) || testerRegistry.isRegistered(chatId)) {
    await next();
    return;
  }

  // Let the "I Agree" tap itself flow through to its handler below.
  if (ctx.callbackQuery?.data === AGREE_CALLBACK) {
    await next();
    return;
  }

  if (!testerRegistry.hasCapacity()) {
    await ctx.reply(fullMessage());
    return;
  }

  await ctx.reply(DISCLOSURE_TEXT, { reply_markup: disclosureKeyboard() });
}

export function registerConsentHandler(bot: Bot): void {
  bot.on("callback_query:data", async (ctx, next) => {
    if (ctx.callbackQuery.data !== AGREE_CALLBACK) {
      await next();
      return;
    }

    await ctx.answerCallbackQuery();

    if (!ctx.chat) return;

    if (!testerRegistry.isRegistered(ctx.chat.id) && !testerRegistry.hasCapacity()) {
      await ctx.reply(fullMessage());
      return;
    }

    await testerRegistry.register(ctx.chat.id);
    await sendWelcome(ctx);
  });
}
