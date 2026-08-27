import type { Context, NextFunction } from "grammy";

const WINDOW_MS = 10_000;
const MAX_REQUESTS_PER_WINDOW = 10;
const STALE_AFTER_MS = 10 * 60 * 1000;

type Bucket = { count: number; windowStart: number; lastSeen: number };

const buckets = new Map<number, Bucket>();

function sweepStale(): void {
  const now = Date.now();
  for (const [chatId, bucket] of buckets) {
    if (now - bucket.lastSeen > STALE_AFTER_MS) buckets.delete(chatId);
  }
}

// Prevents unbounded growth of `buckets` over long uptime with many distinct users.
// `.unref()` so this timer never keeps the process alive on its own.
setInterval(sweepStale, STALE_AFTER_MS).unref();

/** Caps each chat to MAX_REQUESTS_PER_WINDOW updates per WINDOW_MS, protecting shared resources
 * (CPU, and the production ColorSense API behind /trending and /search) from a single abusive or
 * malfunctioning client. */
export async function rateLimit(ctx: Context, next: NextFunction): Promise<void> {
  const chatId = ctx.chat?.id;
  if (chatId === undefined) {
    await next();
    return;
  }

  const now = Date.now();
  const bucket = buckets.get(chatId);

  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(chatId, { count: 1, windowStart: now, lastSeen: now });
    await next();
    return;
  }

  bucket.lastSeen = now;
  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) {
    await ctx.reply("Let's slow down a beat — try again in a few seconds.");
    return;
  }

  bucket.count++;
  await next();
}
