import { afterEach, describe, expect, it, vi } from "vitest";

const configState = { apiKey: undefined as string | undefined };

vi.mock("../src/config.js", () => ({
  COLORSENSE_API_BASE_URL: "https://colorsense.online",
  get TELEGRAM_LINK_API_KEY() {
    return configState.apiKey;
  },
}));

const { confirmLink, getPaletteFixUsage } = await import("../src/lib/accountLink.js");

function mockResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response;
}

describe("confirmLink", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    configState.apiKey = undefined;
  });

  it("returns false without calling the API when no key is configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await confirmLink("ABC123", 42);

    expect(result).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the code and chat id, returning true on success", async () => {
    configState.apiKey = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    const result = await confirmLink("ABC123", 42);

    expect(result).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://colorsense.online/api/telegram/link");
    expect(JSON.parse(init.body)).toEqual({ code: "ABC123", chatId: 42 });
    expect(init.headers.Authorization).toBe("Bearer test-key");
  });

  it("returns false when the code is rejected", async () => {
    configState.apiKey = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({}, false)));

    expect(await confirmLink("WRONG", 42)).toBe(false);
  });

  it("returns false instead of throwing on a network failure", async () => {
    configState.apiKey = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    expect(await confirmLink("ABC123", 42)).toBe(false);
  });
});

describe("getPaletteFixUsage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    configState.apiKey = undefined;
  });

  it("returns null without calling the API when no key is configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await getPaletteFixUsage(42)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the parsed usage for a capped account", async () => {
    configState.apiKey = "test-key";
    const usage = { used: 1, limit: 2, remaining: 1, unlimited: false };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(usage)));

    expect(await getPaletteFixUsage(42)).toEqual(usage);
  });

  it("returns null limit/remaining for an unlimited (Pro) account", async () => {
    configState.apiKey = "test-key";
    const usage = { used: 5, limit: null, remaining: null, unlimited: true };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(usage)));

    expect(await getPaletteFixUsage(42)).toEqual(usage);
  });

  it("returns null for an unlinked chat instead of throwing", async () => {
    configState.apiKey = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(null, false)));

    expect(await getPaletteFixUsage(42)).toBeNull();
  });
});
