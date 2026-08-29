import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyLaumaFailure } from "../src/lib/laumaChat.js";

const configState = { apiKey: undefined as string | undefined };

vi.mock("../src/config.js", () => ({
  COLORSENSE_API_BASE_URL: "https://colorsense.online",
  get TELEGRAM_LINK_API_KEY() {
    return configState.apiKey;
  },
}));

const { sendLaumaMessage, getLaumaChatUsage } = await import("../src/lib/laumaChat.js");

function mockResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body } as Response;
}

describe("classifyLaumaFailure", () => {
  it("classifies a 404 as not_linked", () => {
    expect(classifyLaumaFailure(404, { error: "not_linked" })).toEqual({ ok: false, reason: "not_linked" });
  });

  it("classifies a 429 with proOnly as pro_required, ignoring the error text", () => {
    const body = { error: "Lauma Chat is a Pro feature...", proOnly: true, status: { proOnly: true } };
    expect(classifyLaumaFailure(429, body)).toEqual({ ok: false, reason: "pro_required" });
  });

  it("classifies a 429 with fairUseCap as fair_use_cap, carrying the reset time", () => {
    const body = {
      error: "You've reached today's Lauma Chat fair-use limit...",
      fairUseCap: true,
      status: { dailyResetAtUtc: "2026-08-31T00:00:00.000Z" },
    };
    expect(classifyLaumaFailure(429, body)).toEqual({
      ok: false,
      reason: "fair_use_cap",
      resetAtUtc: "2026-08-31T00:00:00.000Z",
    });
  });

  it("falls back to unavailable for a 429 missing both flags", () => {
    expect(classifyLaumaFailure(429, { error: "unexpected shape" })).toEqual({ ok: false, reason: "unavailable" });
  });

  it.each([400, 401, 502, 503])("classifies %i as unavailable", (status) => {
    expect(classifyLaumaFailure(status, { error: "whatever" })).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("sendLaumaMessage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    configState.apiKey = undefined;
  });

  it("returns unavailable without calling the API when no key is configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await sendLaumaMessage(42, "hi", [])).toEqual({ ok: false, reason: "unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts chatId, message, and a bounded history window", async () => {
    configState.apiKey = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ reply: "Hi there!" }));
    vi.stubGlobal("fetch", fetchMock);

    const longHistory = Array.from({ length: 12 }, (_, i) => ({
      role: i % 2 === 0 ? ("user" as const) : ("model" as const),
      text: `turn ${i}`,
    }));

    const result = await sendLaumaMessage(42, "Which accent works with navy?", longHistory);

    expect(result).toEqual({ ok: true, reply: "Hi there!" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://colorsense.online/api/telegram/lauma-chat");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    const sentBody = JSON.parse(init.body);
    expect(sentBody.chatId).toBe(42);
    expect(sentBody.message).toBe("Which accent works with navy?");
    expect(sentBody.history).toHaveLength(8);
    expect(sentBody.history[0]).toEqual({ role: "user", text: "turn 4" });
  });

  it("returns unavailable instead of throwing on a network failure", async () => {
    configState.apiKey = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    expect(await sendLaumaMessage(42, "hi", [])).toEqual({ ok: false, reason: "unavailable" });
  });

  it("returns unavailable when a 200 response has no reply field", async () => {
    configState.apiKey = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({})));

    expect(await sendLaumaMessage(42, "hi", [])).toEqual({ ok: false, reason: "unavailable" });
  });

  it("classifies a not-linked chat", async () => {
    configState.apiKey = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({ error: "not_linked" }, false, 404)));

    expect(await sendLaumaMessage(42, "hi", [])).toEqual({ ok: false, reason: "not_linked" });
  });
});

describe("getLaumaChatUsage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    configState.apiKey = undefined;
  });

  it("returns null without calling the API when no key is configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await getLaumaChatUsage(42)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts only chatId, with no Gemini call involved", async () => {
    configState.apiKey = "test-key";
    const status = {
      tool: "lauma-chat",
      used: 12,
      limit: null,
      plan: "pro",
      resetAt: null,
      unlimited: true,
      allowed: true,
      blocked: false,
      proOnly: false,
      dailyCap: 60,
      dailyUsed: 12,
      dailyResetAtUtc: "2026-08-31T00:00:00.000Z",
    };
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(status));
    vi.stubGlobal("fetch", fetchMock);

    expect(await getLaumaChatUsage(42)).toEqual(status);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://colorsense.online/api/ai-usage/lauma-chat");
    expect(JSON.parse(init.body)).toEqual({ chatId: 42 });
  });

  it("returns null for an unlinked chat instead of throwing", async () => {
    configState.apiKey = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({ error: "not_linked" }, false, 404)));

    expect(await getLaumaChatUsage(42)).toBeNull();
  });

  it("returns null instead of throwing on a network failure", async () => {
    configState.apiKey = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    expect(await getLaumaChatUsage(42)).toBeNull();
  });
});
