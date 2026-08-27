import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./supabase.js";

/**
 * A persisted allowlist of accepted testers, backed by Supabase so the cap
 * survives restarts and redeploys (previously a flat JSON file, which reset
 * on every deploy — the same problem that motivated moving analytics here
 * too). Loaded into memory once at startup so the consent-gate check on
 * every message stays a fast, synchronous lookup rather than a network
 * round-trip per message.
 */

export const MAX_TESTERS = 50;

export class TesterRegistry {
  private chatIds = new Set<number>();

  constructor(private client: SupabaseClient) {}

  async init(): Promise<void> {
    const { data, error } = await this.client.from("testers").select("chat_id");
    if (error) {
      console.error("Failed to load tester registry from Supabase:", error.message);
      return;
    }
    this.chatIds = new Set((data ?? []).map((row) => row.chat_id as number));
  }

  isRegistered(chatId: number): boolean {
    return this.chatIds.has(chatId);
  }

  count(): number {
    return this.chatIds.size;
  }

  hasCapacity(): boolean {
    return this.chatIds.size < MAX_TESTERS;
  }

  async register(chatId: number): Promise<void> {
    if (this.chatIds.has(chatId)) return;
    // Optimistic: update the cache immediately so capacity/registration
    // checks are consistent even if the write below is briefly in flight.
    this.chatIds.add(chatId);
    const { error } = await this.client.from("testers").insert({ chat_id: chatId });
    if (error) {
      console.error("Failed to persist new tester to Supabase:", error.message);
      // Keep them in the in-memory cache regardless — better to let a
      // consented tester through than to re-show the disclosure because of
      // a transient write failure.
    }
  }
}

export const testerRegistry = new TesterRegistry(supabase);
