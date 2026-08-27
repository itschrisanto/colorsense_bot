import type { Bot } from "grammy";
import { OFFICIAL_CONTACT_EMAIL } from "./feedback.js";

const FULL_POLICY_URL = "https://colorsense.online/privacy-policy";

// Scoped specifically to this bot — most of the full website policy (cookies,
// AdSense, affiliate links, the Chrome extension, children's privacy) doesn't
// apply here. Note the one real difference from the website: the website
// processes images client-side in the visitor's browser, so nothing reaches
// its servers; this bot has no browser to run in, so a submitted photo is
// necessarily downloaded and processed server-side, in memory, before being
// discarded. Same outcome (never stored), different mechanism — stated
// accurately rather than copying the website's wording.
const PRIVACY_TEXT = [
  "<b>ColorSense Companion — Privacy</b>",
  "",
  "This covers what happens to your data specifically inside this Telegram bot. It supplements ColorSense's full privacy policy, which governs colorsense.online as a whole.",
  "",
  "<b>1. What we process</b>",
  "<b>Photos:</b> sent to a server (unlike the website, which processes images in your browser), decoded in memory to extract colors, then discarded immediately. Never stored, logged, or shared.",
  "<b>Colors and palettes:</b> hex codes or palettes you mention are kept for up to one hour so follow-ups like \"score that palette\" work, then forgotten. No accounts, no permanent storage.",
  "<b>Feedback:</b> messages sent via /feedback are forwarded directly to the ColorSense team.",
  "<b>Usage stats:</b> anonymous counts of which commands run and how often requests fail, kept to keep the bot reliable. Never includes message content or personal details.",
  "",
  "<b>2. Third parties</b>",
  "This bot runs on Telegram's Bot API, so Telegram's own privacy policy governs your account and messages there. Palette browsing and search query ColorSense's public palette library with no personal data attached. Nothing you send is ever passed to an AI or language-model service — every response here is plain computation.",
  "",
  "<b>3. Your rights</b>",
  "Blocking or deleting this chat removes it on Telegram's side. Since we don't retain personal data beyond the short-lived palette memory described above, there's nothing further to request deletion of.",
  "",
  "<b>4. Contact</b>",
  `Questions about this or how the bot handles your data: <a href="mailto:${OFFICIAL_CONTACT_EMAIL}">${OFFICIAL_CONTACT_EMAIL}</a>, or use /feedback.`,
  "",
  `Full ColorSense privacy policy: <a href="${FULL_POLICY_URL}">${FULL_POLICY_URL}</a>`,
].join("\n");

export function registerPrivacyCommand(bot: Bot): void {
  bot.command("privacy", async (ctx) => {
    await ctx.reply(PRIVACY_TEXT, { parse_mode: "HTML" });
  });
}
