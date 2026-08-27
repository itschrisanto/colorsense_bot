import { COLORSENSE_API_BASE_URL } from "../config.js";
import { retry } from "./retry.js";

export type PaletteCategory = "all" | "premade" | "trending" | "generated" | "user";

export type Palette = {
  id: number;
  slug: string;
  name: string;
  colors: string[];
  photoUrl: string | null;
  season: string | null;
  category: string;
};

export type PalettesResponse = {
  items: Palette[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  categoryCounts: Record<string, number>;
};

const REQUEST_TIMEOUT_MS = 8000;
const FETCH_ATTEMPTS = 2;
const FETCH_RETRY_DELAY_MS = 300;

// Many distinct users will request the exact same page (e.g. trending/page 1)
// close together — caching avoids re-hitting the production database for
// identical, rapidly-repeated queries. Short TTL since palette data does
// change (new submissions, trending shifts).
const CACHE_TTL_MS = 60_000;
const CACHE_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

type CacheEntry = { data: PalettesResponse; expiresAt: number };
const cache = new Map<string, CacheEntry>();

function sweepExpiredCache(): void {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
}
setInterval(sweepExpiredCache, CACHE_SWEEP_INTERVAL_MS).unref();

export async function fetchPalettes(opts: {
  category?: PaletteCategory;
  q?: string;
  page?: number;
  limit?: number;
}): Promise<PalettesResponse> {
  const category = opts.category ?? "all";
  const q = opts.q ?? "";
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 8;

  const cacheKey = `${category}|${q}|${page}|${limit}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const url = new URL("/api/palettes", COLORSENSE_API_BASE_URL);
  url.searchParams.set("category", category);
  if (q) url.searchParams.set("q", q);
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(limit));

  const data = await retry(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`ColorSense API returned ${res.status}`);
      return (await res.json()) as PalettesResponse;
    } finally {
      clearTimeout(timeout);
    }
  }, FETCH_ATTEMPTS, FETCH_RETRY_DELAY_MS);

  cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

export function getCacheSize(): number {
  return cache.size;
}

export function clearCache(): void {
  cache.clear();
}

/** Pings the live API with a minimal request — for an admin connectivity/latency check, bypassing the cache. */
export async function pingApi(): Promise<{ ok: boolean; latencyMs: number; detail: string }> {
  const started = Date.now();
  try {
    const url = new URL("/api/palettes", COLORSENSE_API_BASE_URL);
    url.searchParams.set("category", "all");
    url.searchParams.set("page", "1");
    url.searchParams.set("limit", "1");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      const latencyMs = Date.now() - started;
      if (!res.ok) return { ok: false, latencyMs, detail: `HTTP ${res.status}` };
      return { ok: true, latencyMs, detail: "OK" };
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, latencyMs: Date.now() - started, detail: message };
  }
}
