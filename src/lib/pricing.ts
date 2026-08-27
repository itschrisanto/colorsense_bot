import { InlineKeyboard } from "grammy";

export const PRICING_URL = "https://colorsense.online/pricing";

/** Standard reply for a bot command that maps to a paid website feature. */
export function proFeatureMessage(featureName: string): string {
  return `${featureName} lives on the Pro side of ColorSense.`;
}

/** A "View Pricing" button linking out to the website's pricing page. */
export function proFeatureKeyboard(): InlineKeyboard {
  return new InlineKeyboard().url("View Pricing", PRICING_URL);
}
