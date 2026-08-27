/**
 * Per-chat "current palette" memory — mirrors how ColorSense Lab keeps one
 * shared working palette that every tool reads from and updates. Lets
 * follow-ups like "score that palette" work without the user re-typing hex
 * codes. In-memory only, short-lived, no accounts or persistence involved.
 */

const TTL_MS = 60 * 60 * 1000; // 1 hour
const SWEEP_INTERVAL_MS = 30 * 60 * 1000;

type Entry = { hexes: string[]; expiresAt: number };
const store = new Map<number, Entry>();

export function setActivePalette(chatId: number, hexes: string[]): void {
  store.set(chatId, { hexes, expiresAt: Date.now() + TTL_MS });
}

export function getActivePalette(chatId: number): string[] | undefined {
  const entry = store.get(chatId);
  if (!entry || entry.expiresAt <= Date.now()) return undefined;
  return entry.hexes;
}

function sweepExpired(): void {
  const now = Date.now();
  for (const [chatId, entry] of store) {
    if (entry.expiresAt <= now) store.delete(chatId);
  }
}
setInterval(sweepExpired, SWEEP_INTERVAL_MS).unref();
