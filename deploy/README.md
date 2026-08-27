# Deploying to the Mac Mini

## First-time setup

1. Over Tailscale SSH, clone the repo into place:
   ```bash
   git clone https://github.com/itschrisanto/colorsense_bot.git ~/colorsense-companion-bot
   cd ~/colorsense-companion-bot
   ```
2. Create `.env` from the example and fill in real secrets (never commit this file):
   ```bash
   cp .env.example .env
   nano .env
   ```
3. Install and build:
   ```bash
   npm install
   npm run build
   ```
4. Confirm the `node` path matches the plist's `ProgramArguments` (`which node`); edit the plist if it differs.
5. Create the log directory and install the service:
   ```bash
   mkdir -p ~/Library/Logs/colorsense-companion-bot
   cp deploy/com.chrisantomendez.colorsense-companion-bot.plist ~/Library/LaunchAgents/
   launchctl load ~/Library/LaunchAgents/com.chrisantomendez.colorsense-companion-bot.plist
   ```
6. Check it's running and confirm the startup notification arrived in the admin chat:
   ```bash
   launchctl list | grep colorsense-companion-bot
   tail -20 ~/Library/Logs/colorsense-companion-bot/stdout.log
   ```

## Shipping a change

From the MacBook Air: commit, `git push`.

Over Tailscale SSH on the Mac Mini:
```bash
cd ~/colorsense-companion-bot
git pull
npm install   # only needed if dependencies changed
npm run build
launchctl kickstart -k gui/$(id -u)/com.chrisantomendez.colorsense-companion-bot
```

## Uninstalling

```bash
launchctl unload ~/Library/LaunchAgents/com.chrisantomendez.colorsense-companion-bot.plist
rm ~/Library/LaunchAgents/com.chrisantomendez.colorsense-companion-bot.plist
```

## Daily health check

`ops/health-check.sh`, scheduled via a separate launchd job, runs once a day
(9:00 AM local time) and checks four things: the bot process is running,
Telegram's API is reachable with our token, ColorSense's API is reachable,
and Supabase is reachable. Its only corrective action is restarting this one
service if the process itself isn't running — everything else it finds is
reported to the admin Telegram chat, never guessed at or patched.

Install (one-time):
```bash
chmod +x ops/health-check.sh
cp deploy/com.chrisantomendez.colorsense-companion-bot.healthcheck.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.chrisantomendez.colorsense-companion-bot.healthcheck.plist
```

Run it on demand (doesn't wait for 9 AM):
```bash
launchctl kickstart -k gui/$(id -u)/com.chrisantomendez.colorsense-companion-bot.healthcheck
```

Check its log:
```bash
tail -20 ~/Library/Logs/colorsense-companion-bot/healthcheck.log
```
