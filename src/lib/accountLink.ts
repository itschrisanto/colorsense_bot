import { COLORSENSE_API_BASE_URL, TELEGRAM_LINK_API_KEY } from "../config.js";

/**
 * Talks to ColorSense's account-linking endpoints on behalf of a Telegram
 * chat. The bot never sends a userId — only its own service key plus the
 * chat_id — and the API resolves chat_id -> userId itself from a stored
 * mapping. This is what lets a linked chat check its real, account-tied
 * quotas (e.g. Palette Health AI fixes) instead of a separate bot-only one.
 */

export interface PaletteFixUsage {
  used: number;
  // null on both when the account is unlimited (Pro) — confirmed against
  // the live API rather than assumed, so check `unlimited` first.
  limit: number | null;
  remaining: number | null;
  unlimited: boolean;
}

const REQUEST_TIMEOUT_MS = 8000;

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${TELEGRAM_LINK_API_KEY}`,
    "Content-Type": "application/json",
  };
}

async function postJson(path: string, body: Record<string, unknown>): Promise<Response | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${COLORSENSE_API_BASE_URL}${path}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    console.error(`Account-link request to ${path} failed:`, err);
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

export type LinkFailureReason =
  | "not_configured"
  | "free_limit"
  | "pro_limit"
  | "already_linked_elsewhere"
  | "invalid_code"
  | "used_code"
  | "expired_code"
  | "rate_limited"
  | "unknown";

export type LinkResult = { ok: true } | { ok: false; reason: LinkFailureReason };

// The API doesn't return machine-readable error codes yet — every reason
// below except invalid/expired/rate-limited shares HTTP 409, distinguished
// only by matching substrings in the human-readable `error` message. This
// is fragile: if that wording ever changes, these checks silently stop
// matching and fall through to "unknown" (still a safe, generic failure,
// just a less specific one). Getting real error codes would need its own
// API contract change — not worth blocking on for now.
function classifyFailure(status: number, message: string): LinkFailureReason {
  const lower = message.toLowerCase();
  if (status === 409) {
    if (lower.includes("free plan allows")) return "free_limit";
    if (lower.includes("pro plan allows")) return "pro_limit";
    if (lower.includes("already linked to another")) return "already_linked_elsewhere";
    if (lower.includes("already been used")) return "used_code";
    return "unknown";
  }
  if (status === 404) return "invalid_code";
  if (status === 410) return "expired_code";
  if (status === 429) return "rate_limited";
  return "unknown";
}

/** Redeems a one-time linking code generated on the website, tying this
 * chat_id to whichever ColorSense account the code belongs to. */
export async function confirmLink(code: string, chatId: number): Promise<LinkResult> {
  if (!TELEGRAM_LINK_API_KEY) return { ok: false, reason: "not_configured" };

  const res = await postJson("/api/telegram/link", { code, chatId });
  if (!res) return { ok: false, reason: "unknown" };
  if (res.ok) return { ok: true };

  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return { ok: false, reason: classifyFailure(res.status, body?.error ?? "") };
}

/** Returns the linked account's real Palette Health AI fix usage, or null
 * if this chat isn't linked, linking isn't configured, or the request
 * fails — callers should treat null as "fall back to the unlinked path,"
 * not as "zero fixes remaining." */
export async function getPaletteFixUsage(chatId: number): Promise<PaletteFixUsage | null> {
  if (!TELEGRAM_LINK_API_KEY) return null;
  const res = await postJson("/api/ai-usage/palette-fix", { chatId });
  if (!res?.ok) return null;
  return (await res.json()) as PaletteFixUsage;
}
