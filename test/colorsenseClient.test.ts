import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPalettes, getCacheSize, clearCache, pingApi } from "../src/lib/colorsenseClient.js";

function mockResponse(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  } as Response;
}

const SAMPLE = { items: [], total: 0, page: 1, pageSize: 8, totalPages: 0, categoryCounts: {} };

describe("fetchPalettes", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("caches identical requests instead of refetching", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(SAMPLE));
    vi.stubGlobal("fetch", fetchMock);

    await fetchPalettes({ category: "trending", page: 1, limit: 8 });
    await fetchPalettes({ category: "trending", page: 1, limit: 8 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats different params as separate cache entries", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(SAMPLE));
    vi.stubGlobal("fetch", fetchMock);

    await fetchPalettes({ category: "premade", page: 1, limit: 8 });
    await fetchPalettes({ category: "generated", page: 1, limit: 8 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries once on failure before succeeding", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network blip"))
      .mockResolvedValueOnce(mockResponse(SAMPLE));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchPalettes({ category: "user", page: 1, limit: 8 });

    expect(result).toEqual(SAMPLE);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting retries on persistent failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(null, false));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPalettes({ category: "all", q: "persistent-failure-case", page: 1, limit: 8 })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("cache admin controls", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports cache size and clears it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(SAMPLE));
    vi.stubGlobal("fetch", fetchMock);

    clearCache();
    expect(getCacheSize()).toBe(0);

    await fetchPalettes({ category: "all", q: "cache-size-test", page: 1, limit: 8 });
    expect(getCacheSize()).toBeGreaterThan(0);

    clearCache();
    expect(getCacheSize()).toBe(0);
  });
});

describe("pingApi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports ok with latency on a successful response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(SAMPLE)));
    const result = await pingApi();
    expect(result.ok).toBe(true);
    expect(result.detail).toBe("OK");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("reports not-ok with the HTTP status on a failed response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(null, false)));
    const result = await pingApi();
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("500");
  });

  it("reports not-ok with the error message on a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await pingApi();
    expect(result.ok).toBe(false);
    expect(result.detail).toBe("network down");
  });
});
