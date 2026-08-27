import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from "../config.js";

// Server-side only — uses the service_role (secret) key, which bypasses Row
// Level Security entirely. Never expose this client or key to a browser.
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});
