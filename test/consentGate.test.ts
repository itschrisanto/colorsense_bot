import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Context } from "grammy";

vi.mock("../src/lib/registry.js", () => {
  const state = { registered: new Set<number>() };
  return {
    testerRegistry: {
      isRegistered: (id: number) => state.registered.has(id),
      count: () => state.registered.size,
      register: (id: number) => state.registered.add(id),
    },
    __state: state,
  };
});

vi.mock("../src/config.js", () => ({ ADMIN_CHAT_ID: "9999" }));

const { consentGate } = await import("../src/middleware/consentGate.js");
const { __state } = (await import("../src/lib/registry.js")) as unknown as { __state: { registered: Set<number> } };

function fakeCtx(opts: { chatId?: number; callbackData?: string } = {}): Context {
  return {
    chat: opts.chatId !== undefined ? { id: opts.chatId } : undefined,
    callbackQuery: opts.callbackData ? { data: opts.callbackData } : undefined,
    reply: vi.fn().mockResolvedValue(undefined),
  } as unknown as Context;
}

describe("consentGate", () => {
  beforeEach(() => {
    __state.registered = new Set<number>();
  });

  it("lets the admin chat through unconditionally", async () => {
    const ctx = fakeCtx({ chatId: 9999 });
    const next = vi.fn().mockResolvedValue(undefined);
    await consentGate(ctx, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it("lets an already-registered chat through", async () => {
    __state.registered.add(1001);
    const ctx = fakeCtx({ chatId: 1001 });
    const next = vi.fn().mockResolvedValue(undefined);
    await consentGate(ctx, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("shows the disclosure to a new chat", async () => {
    const ctx = fakeCtx({ chatId: 2002 });
    const next = vi.fn().mockResolvedValue(undefined);
    await consentGate(ctx, next);
    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    expect((ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toContain("I Agree");
  });

  it("lets the I Agree callback itself pass through even for an unregistered chat", async () => {
    const ctx = fakeCtx({ chatId: 4004, callbackData: "consent:agree" });
    const next = vi.fn().mockResolvedValue(undefined);
    await consentGate(ctx, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(ctx.reply).not.toHaveBeenCalled();
  });
});
