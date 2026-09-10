import type { Bot } from "grammy";
import { sendWaitlistPrompt } from "../lib/waitlist.js";

// Real implementations still live in harmony.ts, health.ts, contrast.ts,
// browse.ts, link.ts, lauma.ts — just not registered below. Keeping the code
// in place (rather than deleting it) is deliberate: the iOS app isn't live
// yet, so this is easy to reverse if the launch timeline moves.
const GATED_COMMANDS = ["harmony", "health", "contrast", "trending", "search", "link", "lauma", "endlauma"];

export function registerGatedCommands(bot: Bot): void {
  bot.command(GATED_COMMANDS, async (ctx) => {
    const command = ctx.message?.text.slice(1).split(/[\s@]/)[0] ?? "unknown";
    await sendWaitlistPrompt(ctx, command);
  });
}
