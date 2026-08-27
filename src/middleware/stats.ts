import type { Context, NextFunction } from "grammy";

type CommandStats = { count: number; errors: number; totalDurationMs: number; uniqueChats: Set<number> };
type ErrorEntry = { at: number; label: string; message: string };

const startTime = Date.now();
const perCommand = new Map<string, CommandStats>();
const recentErrors: ErrorEntry[] = [];
const MAX_RECENT_ERRORS = 10;

// chatId -> last-seen timestamp. Only ever holds accepted testers (+ admin) —
// the consent gate already filters everyone else out before reaching this
// middleware — so this stays small (at most MAX_TESTERS + 1 entries) with no
// need for its own eviction sweep.
const lastSeenByChat = new Map<number, number>();

const LOG_INTERVAL_MS = 30 * 60 * 1000;
const DEFAULT_ACTIVE_WINDOW_MS = 5 * 60 * 1000;

function labelFor(ctx: Context): string {
  const text = ctx.message?.text;
  if (text?.startsWith("/")) return text.split(/\s+/)[0]!.split("@")[0]!;
  if (ctx.message?.photo) return "photo";
  if (ctx.callbackQuery) return "callback_query";
  if (ctx.message?.text) return "text"; // menu-button taps, handled by bot.hears
  return "other";
}

/** Times every processed update and tallies counts/errors/latency/unique-users by command label. */
export async function statsMiddleware(ctx: Context, next: NextFunction): Promise<void> {
  const label = labelFor(ctx);
  const chatId = ctx.chat?.id;
  if (chatId !== undefined) lastSeenByChat.set(chatId, Date.now());

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
    const entry = perCommand.get(label) ?? { count: 0, errors: 0, totalDurationMs: 0, uniqueChats: new Set<number>() };
    entry.count++;
    entry.totalDurationMs += duration;
    if (errored) entry.errors++;
    if (chatId !== undefined) entry.uniqueChats.add(chatId);
    perCommand.set(label, entry);
  }
}

/** Distinct chats seen within the given window (default 5 minutes). */
export function getActiveUserCount(windowMs: number = DEFAULT_ACTIVE_WINDOW_MS): number {
  const now = Date.now();
  let count = 0;
  for (const ts of lastSeenByChat.values()) {
    if (now - ts <= windowMs) count++;
  }
  return count;
}

export function getStatsSummary(): string {
  const uptimeMin = Math.round((Date.now() - startTime) / 60_000);
  const lines = [`Uptime: ${uptimeMin}m`, `Active now (5m): ${getActiveUserCount()}`];
  const rows = [...perCommand.entries()].sort((a, b) => b[1].count - a[1].count);

  if (rows.length === 0) {
    lines.push("No requests yet.");
  } else {
    for (const [label, s] of rows) {
      const avg = Math.round(s.totalDurationMs / s.count);
      lines.push(`${label}: ${s.count} req (${s.uniqueChats.size} users), ${s.errors} errors, avg ${avg}ms`);
    }
  }
  return lines.join("\n");
}

/** Features ranked by how many distinct people have used them — a better
 * "what's popular" signal than raw request counts, which a few chatty users
 * can skew. */
export function getPopularFeaturesSummary(): string {
  const rows = [...perCommand.entries()]
    .filter(([, s]) => s.uniqueChats.size > 0)
    .sort((a, b) => b[1].uniqueChats.size - a[1].uniqueChats.size);

  if (rows.length === 0) return "No usage recorded yet.";
  return rows.map(([label, s], i) => `${i + 1}. ${label} — ${s.uniqueChats.size} users (${s.count} requests)`).join("\n");
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
