import { Bot } from "grammy";
import { TELEGRAM_BOT_TOKEN } from "./config.js";
import { registerStartCommand } from "./commands/start.js";
import { sendAdminMessage } from "./notify.js";

const bot = new Bot(TELEGRAM_BOT_TOKEN);

registerStartCommand(bot);

bot.catch((err) => {
  console.error("Unhandled bot error:", err);
});

bot.start({
  onStart: async () => {
    console.log("ColorSense Companion is polling for updates.");
    await sendAdminMessage(bot, `ColorSense Companion started at ${new Date().toISOString()}`);
  },
});
