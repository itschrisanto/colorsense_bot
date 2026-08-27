#!/bin/bash
# Daily health check for colorsense-companion-bot.
#
# Scope, deliberately narrow: checks four signals (process running, Telegram
# reachable, ColorSense API reachable, Supabase reachable). The ONLY
# corrective action it's allowed to take is restarting this one launchd
# service, and only if the process itself isn't running. Anything else it
# finds is reported to the admin Telegram chat, never guessed at or patched.

set -uo pipefail
cd "$(dirname "$0")/.."
set -a
source .env
set +a

SERVICE_LABEL="com.chrisantomendez.colorsense-companion-bot"
ISSUES=()
ACTIONS=()

notify() {
  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d "chat_id=${ADMIN_CHAT_ID}" \
    --data-urlencode "text=$1" > /dev/null
}

# Independent of the Telegram notify above — if Telegram itself is the thing
# that's down, that notify() call silently fails too. Sentry's Cron Monitor
# is a separate channel that still catches a missed or failed run either way.
cron_checkin() {
  [[ -n "${SENTRY_CRON_URL:-}" ]] && curl -s "${SENTRY_CRON_URL}?status=$1" > /dev/null
}

get_pid() {
  launchctl list 2>/dev/null | grep "$SERVICE_LABEL" | awk '{print $1}'
}

# 1. Is the launchd service running?
PID="$(get_pid)"
if [[ -z "$PID" || "$PID" == "-" ]]; then
  ISSUES+=("process not running")
fi

# 2. Telegram API reachable with our token?
if ! curl -sf --max-time 10 "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" > /dev/null; then
  ISSUES+=("Telegram getMe check failed")
fi

# 3. ColorSense API reachable?
if ! curl -sf --max-time 10 "${COLORSENSE_API_BASE_URL}/api/palettes?limit=1" > /dev/null; then
  ISSUES+=("ColorSense API unreachable")
fi

# 4. Supabase reachable?
if ! curl -sf --max-time 10 \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  "${SUPABASE_URL}/rest/v1/testers?select=chat_id&limit=1" > /dev/null; then
  ISSUES+=("Supabase unreachable")
fi

# Narrow auto-heal: restart THIS service, only if the process check failed.
for issue in "${ISSUES[@]:-}"; do
  if [[ "$issue" == "process not running" ]]; then
    launchctl kickstart -k "gui/$(id -u)/${SERVICE_LABEL}"
    sleep 5
    PID_AFTER="$(get_pid)"
    if [[ -n "$PID_AFTER" && "$PID_AFTER" != "-" ]]; then
      ACTIONS+=("restarted the service — now running (PID ${PID_AFTER})")
    else
      ACTIONS+=("attempted a restart, but it still isn't running — needs a look")
    fi
  fi
done

if [[ ${#ISSUES[@]} -eq 0 ]]; then
  notify "✅ ColorSense Companion daily health check: all good."
  cron_checkin "ok"
else
  MSG="⚠️ ColorSense Companion health check found issues:"
  for i in "${ISSUES[@]}"; do MSG="${MSG}"$'\n'"- ${i}"; done
  if [[ ${#ACTIONS[@]} -gt 0 ]]; then
    MSG="${MSG}"$'\n\n'"Actions taken:"
    for a in "${ACTIONS[@]}"; do MSG="${MSG}"$'\n'"- ${a}"; done
  fi
  notify "$MSG"
  cron_checkin "error"
fi
