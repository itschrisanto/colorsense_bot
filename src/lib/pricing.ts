import { InlineKeyboard } from "grammy";

export const PRICING_URL = "https://colorsense.online/pricing";
export const TELEGRAM_BOT_PAGE_URL = "https://colorsense.online/telegram-bot";
export const TELEGRAM_CONNECTIONS_URL = "https://colorsense.online/account#telegram";
export const SVG_RECOLOR_URL = "https://colorsense.online/svg-recolor";

/** A "View Pricing" button linking out to the website's pricing page. */
export function proFeatureKeyboard(): InlineKeyboard {
  return new InlineKeyboard().url("View Pricing", PRICING_URL);
}
