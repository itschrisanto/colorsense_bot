import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from "../config.js";

// Server-side only — uses the service_role (secret) key, which bypasses Row
// Level Security entirely. Never expose this client or key to a browser.
// autoRefreshToken defaults to true, which runs a background session-refresh
// timer even for a static service-role key with no real user session to
// refresh — the likely source of the periodic (not per-request) "JWT issued
// at future" errors seen in production. Nothing here uses Supabase Auth
// sessions at all, so both are safe to disable.
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// "JWT issued at future" recurred even with autoRefreshToken disabled, which
// rules out a client-side token-refresh cause — the service-role key is a
// static, long-lived JWT whose iat never changes. Sparse, clustered
// occurrences (not sustained) point to a brief clock-skew condition on
// Supabase's own infrastructure momentarily rejecting a perfectly valid
// token — not something a client-side config change can fix. A short retry
// is the correct response to a genuinely transient upstream blip.
const TRANSIENT_ERROR_PATTERNS = ["jwt issued at future"];
const TRANSIENT_RETRY_DELAY_MS = 500;

function isTransientSupabaseError(message: string): boolean {
  const lower = message.toLowerCase();
  return TRANSIENT_ERROR_PATTERNS.some((p) => lower.includes(p));
}

/** Runs a Supabase query, retrying once after a short delay if it fails with
 * a known-transient error. Any other error (or a second failure) passes
 * through unchanged for the caller to handle as before. Takes a thenable
 * rather than a Promise — Supabase's query builders are PromiseLike, not
 * full Promises (no .catch/.finally), so `await`ing them here is what makes
 * this work for a plain builder expression at each call site. */
export async function withTransientRetry<T>(
  run: () => PromiseLike<{ data: T; error: { message: string } | null }>,
): Promise<{ data: T; error: { message: string } | null }> {
  const first = await run();
  if (!first.error || !isTransientSupabaseError(first.error.message)) return first;

  console.warn(`Retrying after transient Supabase error: ${first.error.message}`);
  await new Promise((resolve) => setTimeout(resolve, TRANSIENT_RETRY_DELAY_MS));
  return run();
}
