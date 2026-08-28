import type { Bot } from "grammy";
import { isValidHex, normalizeHex } from "../lib/wcagContrast.js";
import { promptHarmonyTypes } from "./harmony.js";
import { runHealthCheck } from "./health.js";
import { showBrowsePage, showSearchPage } from "./browse.js";
import { runContrastCheck, sendContrastUsage } from "./contrast.js";
import { getActivePalette } from "../lib/activePalette.js";
import { SVG_RECOLOR_URL } from "../lib/pricing.js";
import { recordUsageEvent } from "../middleware/stats.js";

/**
 * Free, rule-based intent routing for plain text (no slash command). Runs
 * only for messages that didn't already match a registered command or menu
 * button — grammy auto-passes those through to this handler, registered
 * last. Pattern-matching, not real language understanding: it covers
 * realistic everyday phrasing, not every possible way to phrase a request.
 * Dispatches to the exact same functions the slash commands use, so behavior
 * (and cost — zero AI) is identical either way.
 *
 * "That palette" / "this one" style follow-ups are resolved against the
 * chat's active palette (see lib/activePalette.ts) when the message itself
 * has no hex codes — mirrors ColorSense Lab's single shared working palette.
 */

export type Intent =
  | { type: "photoNudge" }
  | { type: "contrast"; hexes?: [string, string] }
  | { type: "trending" }
  | { type: "search"; query: string }
  | { type: "harmony"; hex: string }
  | { type: "health"; hexes: string[] }
  | { type: "svgRecolor" }
  | { type: "unknown" };

// Requires a leading # — a bare 6-hex-digit token (no #) is indistinguishable
// from an ordinary English word that happens to use only a-f letters (e.g.
// "facade", "deface"), which caused real false positives in free-text
// messages. Slash-command argument parsing elsewhere is unaffected and still
// accepts hex with or without # (that context is already unambiguous).
const HEX_TOKEN_RE = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g;

export function extractHexCodes(text: string): string[] {
  const matches = text.match(HEX_TOKEN_RE) ?? [];
  const hexes: string[] = [];
  for (const raw of matches) {
    if (isValidHex(raw)) hexes.push(normalizeHex(raw));
  }
  return hexes;
}

function hasAny(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

const PHOTO_WORDS = ["photo", "picture", "image", "pic"];
const EXTRACT_WORDS = ["extract", "pull", "grab"];
const CONTRAST_WORDS = ["contrast", "wcag", "accessib"];
const SVG_WORDS = ["svg", "vector"];
const RECOLOR_WORDS = ["recolor", "re-color"];
const RECOLOR_TARGET_WORDS = ["logo", "icon"];
const TRENDING_WORDS = ["trending", "what's hot", "whats hot", "popular palette"];
const SEARCH_WORDS = ["search", "find", "looking for"];
const HARMONY_WORDS = ["scheme", "harmony", "harmonies", "complement", "combo", "combination", "goes with", "pairs with", "pair with", "matches with"];
const HEALTH_WORDS = ["score", "health", "rate this", "grade this", "evaluate", "how good is", "check this palette", "that palette"];

const SEARCH_STOPWORDS = /\b(search|find|looking for|palettes?|colors?|for|me|please)\b/gi;

/** Pure intent detection — no I/O, fully unit-testable. `activePalette` is the
 * chat's remembered "current palette," used only as a fallback when the
 * message itself contains no hex codes. */
export function detectIntent(raw: string, activePalette?: string[]): Intent {
  const lower = raw.toLowerCase();

  const hexesInText = extractHexCodes(raw);

  if (hasAny(lower, PHOTO_WORDS) && hasAny(lower, EXTRACT_WORDS)) {
    return { type: "photoNudge" };
  }

  if (hasAny(lower, CONTRAST_WORDS)) {
    const pair = hexesInText.length >= 2 ? hexesInText : activePalette;
    if (pair && pair.length >= 2) {
      return { type: "contrast", hexes: [pair[0]!, pair[1]!] };
    }
    return { type: "contrast" };
  }

  // Specific enough on their own ("svg", "vector") to trigger alone;
  // "logo"/"icon" are too generic by themselves, so those only count
  // alongside an explicit recolor word.
  if (hasAny(lower, SVG_WORDS) || (hasAny(lower, RECOLOR_WORDS) && hasAny(lower, RECOLOR_TARGET_WORDS))) {
    return { type: "svgRecolor" };
  }

  if (hasAny(lower, TRENDING_WORDS)) {
    return { type: "trending" };
  }

  if (hasAny(lower, SEARCH_WORDS)) {
    const query = raw.replace(SEARCH_STOPWORDS, "").trim();
    if (query) return { type: "search", query };
  }

  if (hasAny(lower, HARMONY_WORDS)) {
    const hex = hexesInText[0] ?? activePalette?.[0];
    if (hex) return { type: "harmony", hex };
  }

  if (hasAny(lower, HEALTH_WORDS)) {
    const hexes = hexesInText.length >= 2 ? hexesInText : activePalette;
    if (hexes && hexes.length >= 2) return { type: "health", hexes };
  }

  // No keyword matched — fall back on hex count actually present in this
  // message (not the remembered palette): one color reads as "build me
  // something from this," two or more reads as "score this."
  if (hexesInText.length === 1) {
    return { type: "harmony", hex: hexesInText[0]! };
  }
  if (hexesInText.length >= 2) {
    return { type: "health", hexes: hexesInText };
  }

  return { type: "unknown" };
}

export function registerNaturalLanguage(bot: Bot): void {
  bot.on("message:text", async (ctx) => {
    const activePalette = ctx.chat ? getActivePalette(ctx.chat.id) : undefined;
    const intent = detectIntent(ctx.message.text.trim(), activePalette);

    switch (intent.type) {
      case "photoNudge":
        await ctx.reply("Send me the photo and I'll take it from there.");
        return;
      case "contrast":
        if (intent.hexes) {
          await runContrastCheck(ctx, intent.hexes[0], intent.hexes[1]);
        } else {
          await sendContrastUsage(ctx);
        }
        return;
      case "trending":
        await showBrowsePage(ctx, "trending", 1, false);
        return;
      case "search":
        await showSearchPage(ctx, intent.query, 1, false);
        return;
      case "harmony":
        await promptHarmonyTypes(ctx, intent.hex);
        return;
      case "health":
        await runHealthCheck(ctx, intent.hexes);
        return;
      case "svgRecolor":
        recordUsageEvent(ctx.chat?.id, "svg_recolor_mention", 0, false);
        await ctx.reply(`Recoloring an SVG to match your palette is a Pro feature — here's how it works: ${SVG_RECOLOR_URL}`);
        return;
      case "unknown":
        await ctx.reply("Not sure I caught that — type /faq if you want the rundown of what I can do.");
        return;
    }
  });
}
