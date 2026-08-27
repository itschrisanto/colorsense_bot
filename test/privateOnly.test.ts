import { describe, expect, it, vi } from "vitest";
import type { Context } from "grammy";
import { privateOnly } from "../src/middleware/privateOnly.js";

function fakeCtx(chatType: string | undefined) {
  return {
    chat: chatType ? { type: chatType } : undefined,
    reply: vi.fn().mockResolvedValue(undefined),
  } as unknown as Context;
}

describe("privateOnly", () => {
  it("allows private chats through", async () => {
    const ctx = fakeCtx("private");
    const next = vi.fn().mockResolvedValue(undefined);
    await privateOnly(ctx, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it("blocks group chats", async () => {
    const ctx = fakeCtx("group");
    const next = vi.fn().mockResolvedValue(undefined);
    await privateOnly(ctx, next);
    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledTimes(1);
  });

  it("blocks supergroup and channel chats", async () => {
    for (const type of ["supergroup", "channel"]) {
      const ctx = fakeCtx(type);
      const next = vi.fn().mockResolvedValue(undefined);
      await privateOnly(ctx, next);
      expect(next).not.toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalledTimes(1);
    }
  });

  it("passes through updates with no chat context", async () => {
    const ctx = fakeCtx(undefined);
    const next = vi.fn().mockResolvedValue(undefined);
    await privateOnly(ctx, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
