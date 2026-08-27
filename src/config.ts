import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const TELEGRAM_BOT_TOKEN = requireEnv("TELEGRAM_BOT_TOKEN");
export const ADMIN_CHAT_ID = requireEnv("ADMIN_CHAT_ID");

// Not required yet — only the placeholder /start command exists so far.
// This becomes required once the palette-browsing feature (colorsenseClient.ts) is added.
export const COLORSENSE_API_BASE_URL = process.env["COLORSENSE_API_BASE_URL"];
