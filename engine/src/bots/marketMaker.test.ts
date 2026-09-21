import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MarketMaker, type MarketMakerConfig } from "./marketMaker.js";
import { ExchangeState } from "../exchangeState.js";

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CONFIG: MarketMakerConfig = {
  userId: "mm_acme",
  symbol: "ACME",
  anchorInCents: 5000,
  spreadInCents: 10,
  levels: 8,
  quantityPerLevel: 100,
  driftInCents: 15,
};

describe("market maker across a restart", () => {
  let dir: string;
  let logPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "exchange-mm-"));
    logPath = join(dir, "events.jsonl");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("takes over its old quotes instead of stacking new ones on top", () => {
    const before = new ExchangeState(logPath);
    const first = new MarketMaker(before, CONFIG, mulberry32(1));
    for (let i = 0; i < 30; i += 1) {
      first.step(() => undefined);
    }
    before.close();

    const after = new ExchangeState(logPath);
    const second = new MarketMaker(after, CONFIG, mulberry32(2));
    second.step(() => undefined);

    const book = after.exchange.engine.snapshot("ACME", 50);
    expect(book.bids).toHaveLength(8);
    expect(book.asks).toHaveLength(8);
    after.close();
  });

  it("never leaves the book crossed after a restart", () => {
    const before = new ExchangeState(logPath);
    const first = new MarketMaker(before, CONFIG, mulberry32(3));
    for (let i = 0; i < 30; i += 1) {
      first.step(() => undefined);
    }
    before.close();

    const after = new ExchangeState(logPath);
    const second = new MarketMaker(after, CONFIG, mulberry32(4));
    for (let i = 0; i < 5; i += 1) {
      second.step(() => undefined);
      const book = after.exchange.engine.snapshot("ACME", 1);
      expect(book.bids[0]!.priceInCents).toBeLessThan(book.asks[0]!.priceInCents);
    }
    after.close();
  });
});