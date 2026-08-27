import { afterEach, describe, expect, it, vi } from "vitest";
import type { Context } from "grammy";
import { statsMiddleware, getStatsSummary, getRecentErrorsSummary, getActiveUserCount, getPopularFeaturesSummary } from "../src/middleware/stats.js";

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

describe("statsMiddleware", () => {
  it("labels and counts a slash command", async () => {
    const ctx = fakeCtx({ text: "/harmony #1F5313" });
    await statsMiddleware(ctx, async () => {});
    expect(getStatsSummary()).toContain("/harmony");
  });

  it("labels a photo message distinctly", async () => {
    const ctx = fakeCtx({ hasPhoto: true });
    await statsMiddleware(ctx, async () => {});
    expect(getStatsSummary()).toContain("photo");
  });

  it("records an error and re-throws it", async () => {
    const ctx = fakeCtx({ text: "/health" });
    await expect(
      statsMiddleware(ctx, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    const summary = getStatsSummary();
    const line = summary.split("\n").find((l) => l.startsWith("/health"));
    expect(line).toBeDefined();
    expect(line).toMatch(/\d+ errors/);
  });

  it("records the error in the recent-errors log", async () => {
    const ctx = fakeCtx({ text: "/trending" });
    await expect(
      statsMiddleware(ctx, async () => {
        throw new Error("distinctive failure marker");
      }),
    ).rejects.toThrow();

    expect(getRecentErrorsSummary()).toContain("distinctive failure marker");
  });
});

describe("getActiveUserCount", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts a chat as active immediately after it's seen", async () => {
    const ctx = fakeCtx({ text: "/search sunset", chatId: 555001 });
    await statsMiddleware(ctx, async () => {});
    expect(getActiveUserCount()).toBeGreaterThanOrEqual(1);
  });

  it("stops counting a chat once it falls outside the window", async () => {
    const ctx = fakeCtx({ text: "/search sunset", chatId: 555002 });
    await statsMiddleware(ctx, async () => {});
    expect(getActiveUserCount(60_000)).toBeGreaterThanOrEqual(1);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 61_000);
    expect(getActiveUserCount(60_000)).toBe(0);
  });
});

describe("getPopularFeaturesSummary", () => {
  it("ranks features by distinct user count, not raw request count", async () => {
    // One user hammering /trending shouldn't outrank two distinct users on /harmony.
    const spammer = 555010;
    const userA = 555011;
    const userB = 555012;

    for (let i = 0; i < 5; i++) {
      await statsMiddleware(fakeCtx({ text: "/trending", chatId: spammer }), async () => {});
    }
    await statsMiddleware(fakeCtx({ text: "/harmony #1F5313", chatId: userA }), async () => {});
    await statsMiddleware(fakeCtx({ text: "/harmony #1F5313", chatId: userB }), async () => {});

    const summary = getPopularFeaturesSummary();
    const harmonyRank = summary.split("\n").findIndex((l) => l.includes("/harmony"));
    const trendingRank = summary.split("\n").findIndex((l) => l.includes("/trending"));
    expect(harmonyRank).toBeLessThan(trendingRank);
    expect(summary).toContain("/harmony — 2 users");
  });
});
