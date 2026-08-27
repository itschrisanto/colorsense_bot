import { describe, expect, it } from "vitest";
import type { Context } from "grammy";
import { statsMiddleware, getStatsSummary, getRecentErrorsSummary } from "../src/middleware/stats.js";

function fakeCtx(overrides: Partial<{ text: string; hasPhoto: boolean; hasCallback: boolean }> = {}): Context {
  return {
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
