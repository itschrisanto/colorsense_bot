import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Context } from "grammy";

type EventRow = { chat_id: number | null; label: string; duration_ms: number; errored: boolean; created_at: string };

vi.mock("../src/lib/supabase.js", () => {
  const state: { events: EventRow[] } = { events: [] };

  function eventsBuilder() {
    let since: string | undefined;
    const builder: PromiseLike<{ data: EventRow[]; error: null }> & Record<string, unknown> = {
      select: () => builder,
      gte: (_col: string, value: string) => {
        since = value;
        return builder;
      },
      insert: (row: Partial<EventRow>) => {
        state.events.push({
          chat_id: row.chat_id ?? null,
          label: row.label!,
          duration_ms: row.duration_ms!,
          errored: row.errored ?? false,
          created_at: new Date().toISOString(),
        });
        return Promise.resolve({ error: null });
      },
      then: (resolve: (v: { data: EventRow[]; error: null }) => unknown) => {
        const rows = since ? state.events.filter((e) => e.created_at >= since!) : state.events;
        return resolve({ data: rows, error: null });
      },
    } as PromiseLike<{ data: EventRow[]; error: null }> & Record<string, unknown>;
    return builder;
  }

  return {
    supabase: {
      from: (table: string) => {
        if (table === "usage_events") return eventsBuilder();
        throw new Error(`Unexpected table in test: ${table}`);
      },
    },
    __state: state,
  };
});

const stats = await import("../src/middleware/stats.js");
const { __state } = (await import("../src/lib/supabase.js")) as unknown as { __state: { events: EventRow[] } };

function fakeCtx(overrides: Partial<{ text: string; hasPhoto: boolean; hasCallback: boolean; chatId: number }> = {}): Context {
  return {
    chat: overrides.chatId !== undefined ? { id: overrides.chatId } : undefined,
    message: overrides.text
      ? { text: overrides.text }
      : overrides.hasPhoto
      ? { photo: [{}] }
      : undefined,
    callbackQuery: overrides.hasCallback ? {} : undefined,
  } as unknown as Context;
}

// Fire-and-forget writes in statsMiddleware don't await the insert, so give
// the microtask queue a tick to flush before asserting on __state.events.
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  __state.events = [];
});

describe("statsMiddleware", () => {
  it("labels and records a slash command", async () => {
    const ctx = fakeCtx({ text: "/harmony #1F5313", chatId: 1 });
    await stats.statsMiddleware(ctx, async () => {});
    await flush();
    expect(__state.events.some((e) => e.label === "/harmony")).toBe(true);
  });

  it("labels a photo message distinctly", async () => {
    const ctx = fakeCtx({ hasPhoto: true, chatId: 1 });
    await stats.statsMiddleware(ctx, async () => {});
    await flush();
    expect(__state.events.some((e) => e.label === "photo")).toBe(true);
  });

  it("records an error and re-throws it", async () => {
    const ctx = fakeCtx({ text: "/health", chatId: 1 });
    await expect(
      stats.statsMiddleware(ctx, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    await flush();

    expect(__state.events.some((e) => e.label === "/health" && e.errored)).toBe(true);
    expect(stats.getRecentErrorsSummary()).toContain("boom");
  });
});

describe("getActiveUserCount", () => {
  it("counts distinct chats seen within the window", async () => {
    await stats.statsMiddleware(fakeCtx({ text: "/search sunset", chatId: 501 }), async () => {});
    await stats.statsMiddleware(fakeCtx({ text: "/trending", chatId: 502 }), async () => {});
    await flush();

    expect(await stats.getActiveUserCount(60_000)).toBeGreaterThanOrEqual(2);
  });

  it("excludes chats seen outside the window", async () => {
    __state.events.push({ chat_id: 900, label: "/faq", duration_ms: 5, errored: false, created_at: "2020-01-01T00:00:00.000Z" });
    expect(await stats.getActiveUserCount(60_000)).toBe(0);
  });
});

describe("getPopularFeaturesSummary", () => {
  it("ranks features by distinct user count, not raw request count", async () => {
    const spammer = 601;
    const userA = 602;
    const userB = 603;

    for (let i = 0; i < 5; i++) {
      await stats.statsMiddleware(fakeCtx({ text: "/trending", chatId: spammer }), async () => {});
    }
    await stats.statsMiddleware(fakeCtx({ text: "/harmony #1F5313", chatId: userA }), async () => {});
    await stats.statsMiddleware(fakeCtx({ text: "/harmony #1F5313", chatId: userB }), async () => {});
    await flush();

    const summary = await stats.getPopularFeaturesSummary();
    const harmonyRank = summary.split("\n").findIndex((l) => l.includes("/harmony"));
    const trendingRank = summary.split("\n").findIndex((l) => l.includes("/trending"));
    expect(harmonyRank).toBeLessThan(trendingRank);
    expect(summary).toContain("/harmony — 2 users");
  });
});
