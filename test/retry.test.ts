import { describe, expect, it, vi } from "vitest";
import { retry } from "../src/lib/retry.js";

describe("retry", () => {
  it("returns the result on first success without retrying", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await retry(fn, 3, 1);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries after a failure and returns the eventual success", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("fail once")).mockResolvedValueOnce("ok");
    const result = await retry(fn, 3, 1);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws the last error after exhausting all attempts", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));
    await expect(retry(fn, 3, 1)).rejects.toThrow("always fails");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
