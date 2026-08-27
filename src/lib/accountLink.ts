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

/** Redeems a one-time linking code generated on the website, tying this
 * chat_id to whichever ColorSense account the code belongs to. Returns
 * false if linking isn't configured yet, the code is wrong/expired/used,
 * or the request itself fails. */
export async function confirmLink(code: string, chatId: number): Promise<boolean> {
  if (!TELEGRAM_LINK_API_KEY) return false;
  const res = await postJson("/api/telegram/link", { code, chatId });
  return res?.ok ?? false;
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
