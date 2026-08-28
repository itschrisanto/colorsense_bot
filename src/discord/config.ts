import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const DISCORD_BOT_TOKEN = requireEnv("DISCORD_BOT_TOKEN");
export const DISCORD_GUILD_ID = requireEnv("DISCORD_GUILD_ID");
export const DISCORD_ADMIN_USER_ID = requireEnv("DISCORD_ADMIN_USER_ID");
