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
export const COLORSENSE_API_BASE_URL = requireEnv("COLORSENSE_API_BASE_URL");
export const SUPABASE_URL = requireEnv("SUPABASE_URL");
export const SUPABASE_SERVICE_KEY = requireEnv("SUPABASE_SERVICE_KEY");

// Optional — real-time error alerting. Local dev works fine without it;
// when unset, Sentry simply never initializes.
export const SENTRY_DSN = process.env["SENTRY_DSN"];
