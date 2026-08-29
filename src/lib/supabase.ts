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
