import { Client, Events, GatewayIntentBits, SlashCommandBuilder } from "discord.js";
import { DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, DISCORD_ADMIN_USER_ID } from "./config.js";

// Trivial skeleton, deliberately — proving the deploy pipeline (push, pull,
// build, launchd restart, startup notification) end-to-end before any real
// palette/health/contrast logic gets wired in, same discipline the Telegram
// bot started with. Guild-scoped command registration is intentional for
// this testing phase: instant availability instead of global commands'
// up-to-an-hour propagation delay.

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const PING_COMMAND = new SlashCommandBuilder().setName("ping").setDescription("Check that ColorSense Companion is alive on Discord.");

client.once(Events.ClientReady, async (readyClient) => {
  const guild = await readyClient.guilds.fetch(DISCORD_GUILD_ID);
  await guild.commands.set([PING_COMMAND]);

  console.log(`ColorSense Companion (Discord) logged in as ${readyClient.user.tag}.`);

  try {
    const admin = await readyClient.users.fetch(DISCORD_ADMIN_USER_ID);
    await admin.send(`ColorSense Companion (Discord) started at ${new Date().toISOString()}`);
  } catch (err) {
    console.error("Failed to notify admin user:", err);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "ping") return;

  await interaction.reply("Pong! ColorSense Companion is alive.");
});

client.login(DISCORD_BOT_TOKEN);
