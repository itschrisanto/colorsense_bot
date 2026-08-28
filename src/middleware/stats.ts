import type { Context, NextFunction } from "grammy";
import { supabase } from "../lib/supabase.js";

type ErrorEntry = { at: number; label: string; message: string };
type Aggregate = { count: number; errors: number; totalDurationMs: number; uniqueChats: Set<number> };

const startTime = Date.now();
const recentErrors: ErrorEntry[] = [];
const MAX_RECENT_ERRORS = 10;

const DEFAULT_ACTIVE_WINDOW_MS = 5 * 60 * 1000;
const EXTENDED_ACTIVE_WINDOW_MS = 30 * 60 * 1000;

function labelFor(ctx: Context): string {
  const text = ctx.message?.text;
  if (text?.startsWith("/")) return text.split(/\s+/)[0]!.split("@")[0]!;
  if (ctx.message?.photo) return "photo";
  if (ctx.callbackQuery) return "callback_query";
  if (ctx.message?.text) return "text"; // menu-button taps, handled by bot.hears
  return "other";
}

/** Fire-and-forget — never adds Supabase network latency to a user's response. */
function recordUsageEvent(chatId: number | undefined, label: string, durationMs: number, errored: boolean): void {
  supabase
    .from("usage_events")
    .insert({ chat_id: chatId ?? null, label, duration_ms: durationMs, errored })
    .then(({ error }) => {
      if (error) console.error("Failed to record usage event:", error.message);
    });
}

/** Times every processed update and records it (durably, non-blocking) by command label. */
export async function statsMiddleware(ctx: Context, next: NextFunction): Promise<void> {
  const label = labelFor(ctx);
  const chatId = ctx.chat?.id;
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
    recordUsageEvent(chatId, label, Date.now() - started, errored);
  }
}

/** Distinct chats seen within the given window (default 5 minutes), queried live from Supabase. */
export async function getActiveUserCount(windowMs: number = DEFAULT_ACTIVE_WINDOW_MS): Promise<number> {
  const since = new Date(Date.now() - windowMs).toISOString();
  const { data, error } = await supabase.from("usage_events").select("chat_id").gte("created_at", since);
  if (error) {
    console.error("Failed to query active users:", error.message);
    return 0;
  }
  return new Set((data ?? []).map((r) => r.chat_id)).size;
}

async function aggregateByLabel(): Promise<Map<string, Aggregate>> {
  const map = new Map<string, Aggregate>();
  const { data, error } = await supabase.from("usage_events").select("label, chat_id, duration_ms, errored");
  if (error) {
    console.error("Failed to query usage events:", error.message);
    return map;
  }
  for (const row of data ?? []) {
    const entry = map.get(row.label) ?? { count: 0, errors: 0, totalDurationMs: 0, uniqueChats: new Set<number>() };
    entry.count++;
    entry.totalDurationMs += row.duration_ms;
    if (row.errored) entry.errors++;
    if (row.chat_id != null) entry.uniqueChats.add(row.chat_id);
    map.set(row.label, entry);
  }
  return map;
}

export async function getStatsSummary(): Promise<string> {
  const uptimeMin = Math.round((Date.now() - startTime) / 60_000);
  const [active5m, active30m, byLabel] = await Promise.all([
    getActiveUserCount(),
    getActiveUserCount(EXTENDED_ACTIVE_WINDOW_MS),
    aggregateByLabel(),
  ]);

  const lines = [`Uptime: ${uptimeMin}m`, `Active now (5m): ${active5m}`, `Active (30m): ${active30m}`];
  const rows = [...byLabel.entries()].sort((a, b) => b[1].count - a[1].count);

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
export async function getPopularFeaturesSummary(): Promise<string> {
  const byLabel = await aggregateByLabel();
  const rows = [...byLabel.entries()]
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

const LOG_INTERVAL_MS = 30 * 60 * 1000;

// Passive visibility into launchd's logs without anyone needing to run /status.
setInterval(() => {
  getStatsSummary()
    .then((summary) => console.log(`--- Stats summary ---\n${summary}`))
    .catch((err) => console.error("Failed to log periodic stats summary:", err));
}, LOG_INTERVAL_MS).unref();
