import type { Bot } from "grammy";
import { ADMIN_CHAT_ID } from "./config.js";

export async function sendAdminMessage(bot: Bot, text: string): Promise<void> {
  try {
    await bot.api.sendMessage(ADMIN_CHAT_ID, text);
  } catch (err) {
    console.error("Failed to notify admin chat:", err);
  }
}
