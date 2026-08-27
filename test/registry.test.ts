import { describe, expect, it, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { TesterRegistry, MAX_TESTERS } from "../src/lib/registry.js";

function tempPath(): string {
  return path.join(os.tmpdir(), `testers-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

const cleanupPaths: string[] = [];

afterEach(() => {
  for (const p of cleanupPaths.splice(0)) {
    try {
      fs.unlinkSync(p);
    } catch {
      // already gone, fine
    }
  }
});

describe("TesterRegistry", () => {
  it("starts empty when no file exists yet", () => {
    const filePath = tempPath();
    cleanupPaths.push(filePath);
    const registry = new TesterRegistry(filePath);
    expect(registry.count()).toBe(0);
    expect(registry.hasCapacity()).toBe(true);
  });

  it("registers a chat and persists it to disk", () => {
    const filePath = tempPath();
    cleanupPaths.push(filePath);
    const registry = new TesterRegistry(filePath);

    registry.register(12345);
    expect(registry.isRegistered(12345)).toBe(true);
    expect(registry.count()).toBe(1);

    const reloaded = new TesterRegistry(filePath);
    expect(reloaded.isRegistered(12345)).toBe(true);
  });

  it("does not double-count a chat registered twice", () => {
    const filePath = tempPath();
    cleanupPaths.push(filePath);
    const registry = new TesterRegistry(filePath);
    registry.register(1);
    registry.register(1);
    expect(registry.count()).toBe(1);
  });

  it("reports no capacity once MAX_TESTERS is reached", () => {
    const filePath = tempPath();
    cleanupPaths.push(filePath);
    const registry = new TesterRegistry(filePath);
    for (let i = 0; i < MAX_TESTERS; i++) registry.register(i);
    expect(registry.count()).toBe(MAX_TESTERS);
    expect(registry.hasCapacity()).toBe(false);
  });
});
