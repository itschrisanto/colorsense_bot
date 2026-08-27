import type { Context, NextFunction } from "grammy";

type CommandStats = { count: number; errors: number; totalDurationMs: number };
type ErrorEntry = { at: number; label: string; message: string };

const startTime = Date.now();
const perCommand = new Map<string, CommandStats>();
const recentErrors: ErrorEntry[] = [];
const MAX_RECENT_ERRORS = 10;

const LOG_INTERVAL_MS = 30 * 60 * 1000;

function labelFor(ctx: Context): string {
  const text = ctx.message?.text;
  if (text?.startsWith("/")) return text.split(/\s+/)[0]!.split("@")[0]!;
  if (ctx.message?.photo) return "photo";
  if (ctx.callbackQuery) return "callback_query";
  if (ctx.message?.text) return "text"; // menu-button taps, handled by bot.hears
  return "other";
}

/** Times every processed update and tallies counts/errors/latency by command label. */
export async function statsMiddleware(ctx: Context, next: NextFunction): Promise<void> {
  const label = labelFor(ctx);
  const started = Date.now();
  let errored = false;
  try {
    await next();
  } catch (err) {
    errored = true;
    const message = err instanceof Error ? err.message : String(err);
    recentErrors.push({ at: Date.now(), label, message });
    if (recentErrors.length > MAX_RECENT_ERRORS) recentErrors.shift();
    throw err;
  } finally {
    const duration = Date.now() - started;
    const entry = perCommand.get(label) ?? { count: 0, errors: 0, totalDurationMs: 0 };
    entry.count++;
    entry.totalDurationMs += duration;
    if (errored) entry.errors++;
    perCommand.set(label, entry);
  }
}

export function getStatsSummary(): string {
  const uptimeMin = Math.round((Date.now() - startTime) / 60_000);
  const lines = [`Uptime: ${uptimeMin}m`];
  const rows = [...perCommand.entries()].sort((a, b) => b[1].count - a[1].count);

  if (rows.length === 0) {
    lines.push("No requests yet.");
  } else {
    for (const [label, s] of rows) {
      const avg = Math.round(s.totalDurationMs / s.count);
      lines.push(`${label}: ${s.count} req, ${s.errors} errors, avg ${avg}ms`);
    }
  }
  return lines.join("\n");
}

export function getRecentErrorsSummary(): string {
  if (recentErrors.length === 0) return "No errors recorded since startup.";
  return recentErrors
    .slice()
    .reverse()
    .map((e) => `${new Date(e.at).toISOString()} — ${e.label}: ${e.message}`)
    .join("\n");
}

// Passive visibility into launchd's logs without anyone needing to run /status.
setInterval(() => {
  console.log(`--- Stats summary ---\n${getStatsSummary()}`);
}, LOG_INTERVAL_MS).unref();
