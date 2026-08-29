import { describe, expect, it, vi } from "vitest";

vi.mock("../src/config.js", () => ({
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_KEY: "test-service-key",
}));

const { withTransientRetry } = await import("../src/lib/supabase.js");

describe("withTransientRetry", () => {
  it("returns the result unchanged when there's no error", async () => {
    const run = vi.fn().mockResolvedValue({ data: [1, 2, 3], error: null });

    const result = await withTransientRetry(run);

    expect(result).toEqual({ data: [1, 2, 3], error: null });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("passes through a non-transient error without retrying", async () => {
    const run = vi.fn().mockResolvedValue({ data: null, error: { message: "permission denied" } });

    const result = await withTransientRetry(run);

    expect(result).toEqual({ data: null, error: { message: "permission denied" } });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("retries once on a transient 'JWT issued at future' error and returns the retry's result", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: "JWT issued at future" } })
      .mockResolvedValueOnce({ data: ["ok"], error: null });

    const result = await withTransientRetry(run);

    expect(result).toEqual({ data: ["ok"], error: null });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("matches the transient error case-insensitively", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: "Invalid token: JWT Issued At Future" } })
      .mockResolvedValueOnce({ data: ["ok"], error: null });

    const result = await withTransientRetry(run);

    expect(result).toEqual({ data: ["ok"], error: null });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("returns the retry's error if it fails again", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: "JWT issued at future" } })
      .mockResolvedValueOnce({ data: null, error: { message: "JWT issued at future" } });

    const result = await withTransientRetry(run);

    expect(result).toEqual({ data: null, error: { message: "JWT issued at future" } });
    expect(run).toHaveBeenCalledTimes(2);
  });
});
