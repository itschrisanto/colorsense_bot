import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TesterRegistry } from "../src/lib/registry.js";

function fakeSupabase(initialRows: { chat_id: number }[] = []) {
  const rows = [...initialRows];
  const inserted: { chat_id: number }[] = [];
  const client = {
    from: (_table: string) => ({
      select: async (_cols: string) => ({ data: rows, error: null }),
      insert: async (row: { chat_id: number }) => {
        rows.push(row);
        inserted.push(row);
        return { error: null };
      },
    }),
  };
  return { client: client as unknown as SupabaseClient, inserted };
}

describe("TesterRegistry", () => {
  it("starts empty when Supabase has no rows yet", async () => {
    const { client } = fakeSupabase([]);
    const registry = new TesterRegistry(client);
    await registry.init();
    expect(registry.count()).toBe(0);
  });

  it("loads existing testers from Supabase on init", async () => {
    const { client } = fakeSupabase([{ chat_id: 111 }, { chat_id: 222 }]);
    const registry = new TesterRegistry(client);
    await registry.init();
    expect(registry.isRegistered(111)).toBe(true);
    expect(registry.isRegistered(222)).toBe(true);
    expect(registry.count()).toBe(2);
  });

  it("registers a new chat and persists it to Supabase", async () => {
    const { client, inserted } = fakeSupabase([]);
    const registry = new TesterRegistry(client);
    await registry.init();

    await registry.register(999);

    expect(registry.isRegistered(999)).toBe(true);
    expect(inserted).toEqual([{ chat_id: 999 }]);
  });

  it("does not double-insert a chat registered twice", async () => {
    const { client, inserted } = fakeSupabase([]);
    const registry = new TesterRegistry(client);
    await registry.init();

    await registry.register(1);
    await registry.register(1);

    expect(registry.count()).toBe(1);
    expect(inserted).toHaveLength(1);
  });

  it("recovers a registration after one transient 'JWT issued at future' failure", async () => {
    let insertCalls = 0;
    const client = {
      from: (_table: string) => ({
        select: async () => ({ data: [], error: null }),
        insert: async () => {
          insertCalls++;
          if (insertCalls === 1) return { error: { message: "JWT issued at future" } };
          return { error: null };
        },
      }),
    } as unknown as SupabaseClient;
    const registry = new TesterRegistry(client);
    await registry.init();

    await registry.register(7);

    expect(registry.isRegistered(7)).toBe(true);
    expect(insertCalls).toBe(2);
  });

  it("keeps a newly registered chat in the cache even if the Supabase write fails", async () => {
    const client = {
      from: (_table: string) => ({
        select: async () => ({ data: [], error: null }),
        insert: async () => ({ error: { message: "network blip" } }),
      }),
    } as unknown as SupabaseClient;
    const registry = new TesterRegistry(client);
    await registry.init();

    await registry.register(42);
    expect(registry.isRegistered(42)).toBe(true);
  });
});
