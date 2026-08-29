import { COLORSENSE_API_BASE_URL, TELEGRAM_LINK_API_KEY } from "../config.js";

/**
 * Talks to ColorSense's Lauma Chat endpoint on behalf of a Telegram chat.
 * Same service-key pattern as accountLink.ts: the bot never sends a userId,
 * only its own key plus chatId, and the API resolves chatId -> userId (and
 * Pro/fair-use status) itself.
 */

export type LaumaTurn = { role: "user" | "model"; text: string };

// Matches the server's own bounded window — sending more here would just be
// silently truncated server-side, so there's no benefit to keeping more.
export const MAX_LAUMA_HISTORY = 8;

export type LaumaResult =
  | { ok: true; reply: string }
  | { ok: false; reason: "not_linked" }
  | { ok: false; reason: "pro_required" }
  | { ok: false; reason: "fair_use_cap"; resetAtUtc: string | null }
  | { ok: false; reason: "unavailable" };

// Gemini round-trips run longer than the account-link lookups elsewhere in
// this file's sibling (accountLink.ts's 8s), so this gets its own timeout.
const REQUEST_TIMEOUT_MS = 15000;

// The status-check endpoint is a pure DB read, no Gemini call — same budget
// as accountLink.ts's lookups, not the longer conversational timeout above.
const STATUS_REQUEST_TIMEOUT_MS = 8000;

export type LaumaUsageStatus = {
  tool: "lauma-chat";
  used: number;
  limit: number | null;
  plan: string;
  resetAt: string | null;
  unlimited: boolean;
  allowed: boolean;
  blocked: boolean;
  proOnly: boolean;
  dailyCap?: number;
  dailyUsed?: number;
  dailyResetAtUtc?: string;
};

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${TELEGRAM_LINK_API_KEY}`,
    "Content-Type": "application/json",
  };
}

/** Pure response classifier — no I/O, fully unit-testable. Only called on a
 * non-2xx response; success is handled separately by the caller. Trusts only
 * the typed `proOnly`/`fairUseCap` flags the API contract guarantees, never
 * the human-readable `error` string (mirrors the explicit instruction in the
 * Lauma Chat spec: don't parse error text). */
export function classifyLaumaFailure(status: number, body: unknown): Extract<LaumaResult, { ok: false }> {
  if (status === 404) return { ok: false, reason: "not_linked" };

  if (status === 429) {
    const b = body as { proOnly?: boolean; fairUseCap?: boolean; status?: { dailyResetAtUtc?: string } } | null;
    if (b?.proOnly) return { ok: false, reason: "pro_required" };
    if (b?.fairUseCap) {
      return { ok: false, reason: "fair_use_cap", resetAtUtc: b.status?.dailyResetAtUtc ?? null };
    }
  }

  // Covers 400/401/502/503, and any 429 missing both flags — all of these
  // are "something went wrong server-side," not something the user caused,
  // so they collapse to one generic retry message.
  return { ok: false, reason: "unavailable" };
}

export async function sendLaumaMessage(
  chatId: number,
  message: string,
  history: LaumaTurn[],
): Promise<LaumaResult> {
  if (!TELEGRAM_LINK_API_KEY) return { ok: false, reason: "unavailable" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${COLORSENSE_API_BASE_URL}/api/telegram/lauma-chat`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ chatId, message, history: history.slice(-MAX_LAUMA_HISTORY) }),
      signal: controller.signal,
    });
  } catch (err) {
    console.error("Lauma chat request failed:", err);
    return { ok: false, reason: "unavailable" };
  } finally {
    clearTimeout(timeout);
  }

  const body = await res.json().catch(() => null);

  if (res.ok) {
    const reply = (body as { reply?: string } | null)?.reply;
    if (!reply) return { ok: false, reason: "unavailable" };
    return { ok: true, reply };
  }

  return classifyLaumaFailure(res.status, body);
}

/** Read-only status check — no Gemini call, so it's safe to call before
 * /lauma opens a session, letting the bot gate access up front instead of
 * only discovering a free/unlinked chat is blocked on its first message.
 * Returns null if this chat isn't linked, linking isn't configured, or the
 * request fails — callers should treat null as "not linked," matching
 * accountLink.ts's getPaletteFixUsage convention. */
export async function getLaumaChatUsage(chatId: number): Promise<LaumaUsageStatus | null> {
  if (!TELEGRAM_LINK_API_KEY) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STATUS_REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${COLORSENSE_API_BASE_URL}/api/ai-usage/lauma-chat`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ chatId }),
      signal: controller.signal,
    });
  } catch (err) {
    console.error("Lauma usage status request failed:", err);
    return null;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as LaumaUsageStatus | null;
}
