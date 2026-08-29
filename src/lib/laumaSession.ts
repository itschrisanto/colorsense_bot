import { MAX_LAUMA_HISTORY, type LaumaTurn } from "./laumaChat.js";

/**
 * Per-chat "in a conversation with Lauma" mode — mirrors activePalette.ts's
 * shape. Entering /lauma flips this on; a plain-text message handler
 * registered ahead of the natural-language router checks it first and
 * intercepts every message for that chat while active, instead of routing
 * through the rule-based intent matcher. In-memory only: losing it on a
 * restart just means resuming a fresh conversation, not a lost account
 * feature (the account-side quota is what's durable, tracked by the API).
 */

const IDLE_TTL_MS = 15 * 60 * 1000; // 15 min of silence ends the conversation
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

type Session = { history: LaumaTurn[]; expiresAt: number };
const store = new Map<number, Session>();

export function isLaumaActive(chatId: number): boolean {
  const s = store.get(chatId);
  return !!s && s.expiresAt > Date.now();
}

export function startLaumaSession(chatId: number): void {
  store.set(chatId, { history: [], expiresAt: Date.now() + IDLE_TTL_MS });
}

export function endLaumaSession(chatId: number): void {
  store.delete(chatId);
}

export function getLaumaHistory(chatId: number): LaumaTurn[] {
  return store.get(chatId)?.history ?? [];
}

/** Appends a turn and refreshes the idle timer. Trims to the same bounded
 * window the API expects, so a long-running chat never grows unbounded
 * in memory even though only the tail ever gets sent. */
export function appendLaumaTurn(chatId: number, turn: LaumaTurn): void {
  const s = store.get(chatId);
  if (!s) return;
  s.history.push(turn);
  if (s.history.length > MAX_LAUMA_HISTORY) {
    s.history.splice(0, s.history.length - MAX_LAUMA_HISTORY);
  }
  s.expiresAt = Date.now() + IDLE_TTL_MS;
}

function sweepExpired(): void {
  const now = Date.now();
  for (const [chatId, s] of store) {
    if (s.expiresAt <= now) store.delete(chatId);
  }
}
setInterval(sweepExpired, SWEEP_INTERVAL_MS).unref();
