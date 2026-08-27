import { describe, expect, it, vi } from "vitest";
import type { Context } from "grammy";
import { rateLimit } from "../src/middleware/rateLimit.js";

function fakeCtx(chatId: number) {
  return {
    chat: { id: chatId },
    reply: vi.fn().mockResolvedValue(undefined),
  } as unknown as Context;
}

describe("rateLimit", () => {
  it("allows requests under the limit through to next()", async () => {
    const ctx = fakeCtx(1001);
    const next = vi.fn().mockResolvedValue(undefined);

    for (let i = 0; i < 10; i++) {
      await rateLimit(ctx, next);
    }

    expect(next).toHaveBeenCalledTimes(10);
    expect((ctx.reply as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it("blocks requests past the limit within the same window", async () => {
    const ctx = fakeCtx(1002);
    const next = vi.fn().mockResolvedValue(undefined);

    for (let i = 0; i < 10; i++) {
      await rateLimit(ctx, next);
    }
    await rateLimit(ctx, next);

    expect(next).toHaveBeenCalledTimes(10);
    expect(ctx.reply).toHaveBeenCalledTimes(1);
  });

  it("tracks separate chats independently", async () => {
    const ctxA = fakeCtx(2001);
    const ctxB = fakeCtx(2002);
    const next = vi.fn().mockResolvedValue(undefined);

    for (let i = 0; i < 10; i++) await rateLimit(ctxA, next);
    await rateLimit(ctxA, next); // blocked
    await rateLimit(ctxB, next); // ctxB's own first request, should pass

    expect(ctxA.reply).toHaveBeenCalledTimes(1);
    expect(ctxB.reply).not.toHaveBeenCalled();
  });

  it("passes through updates with no chat (e.g. some non-message updates)", async () => {
    const ctx = { chat: undefined, reply: vi.fn() } as unknown as Context;
    const next = vi.fn().mockResolvedValue(undefined);

    await rateLimit(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
