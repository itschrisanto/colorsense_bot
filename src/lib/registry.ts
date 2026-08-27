import fs from "node:fs";
import path from "node:path";

/**
 * A persisted allowlist of accepted testers, backed by a plain JSON file.
 * Deliberately not a database — 50 entries, occasional writes, needs to
 * survive restarts. A flat file is the simplest thing that actually works.
 */

export const MAX_TESTERS = 50;

type RegistryEntry = { chatId: number; consentedAt: string };
type RegistryData = { testers: RegistryEntry[] };

export class TesterRegistry {
  private filePath: string;
  private data: RegistryData;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.data = this.load();
  }

  private load(): RegistryData {
    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      return JSON.parse(raw) as RegistryData;
    } catch {
      return { testers: [] };
    }
  }

  private save(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }

  isRegistered(chatId: number): boolean {
    return this.data.testers.some((t) => t.chatId === chatId);
  }

  count(): number {
    return this.data.testers.length;
  }

  hasCapacity(): boolean {
    return this.count() < MAX_TESTERS;
  }

  register(chatId: number): void {
    if (this.isRegistered(chatId)) return;
    this.data.testers.push({ chatId, consentedAt: new Date().toISOString() });
    this.save();
  }
}

const DEFAULT_PATH = path.resolve(process.cwd(), "data", "testers.json");
export const testerRegistry = new TesterRegistry(DEFAULT_PATH);
