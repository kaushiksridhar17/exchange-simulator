import { beforeEach, describe, expect, it } from "vitest";
import { BotRunner } from "./runner.js";
import { MarketMaker } from "./marketMaker.js";
import { ExchangeState } from "../exchangeState.js";
import type { Trade } from "../types.js";

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("bots", () => {
  let state: ExchangeState;
  let changes: string[];
  let trades: Trade[];

  beforeEach(() => {
    state = new ExchangeState(null);
    changes = [];
    trades = [];
  });

  function makeRunner(seed = 1) {
    return new BotRunner({
      state,
      onChange: (symbol) => changes.push(symbol),
      onTrades: (_symbol, executed) => trades.push(...executed),
      random: mulberry32(seed),
    });
  }

  it("quotes both sides of the book", () => {
    makeRunner().tickMakers();

    const book = state.exchange.engine.snapshot("ACME", 10);
    expect(book.bids.length).toBeGreaterThan(0);
    expect(book.asks.length).toBeGreaterThan(0);
  });

  it("quotes five levels per side", () => {
    makeRunner().tickMakers();

    const book = state.exchange.engine.snapshot("ACME", 10);
    expect(book.bids).toHaveLength(5);
    expect(book.asks).toHaveLength(5);
  });

  it("keeps the best bid below the best ask", () => {
    makeRunner().tickMakers();

    for (const symbol of state.symbols()) {
      const book = state.exchange.engine.snapshot(symbol, 1);
      const bid = book.bids[0]?.priceInCents;
      const ask = book.asks[0]?.priceInCents;
      expect(bid).toBeDefined();
      expect(ask).toBeDefined();
      expect(bid!).toBeLessThan(ask!);
    }
  });

  it("quotes every symbol", () => {
    makeRunner().tickMakers();

    for (const symbol of state.symbols()) {
      const book = state.exchange.engine.snapshot(symbol, 1);
      expect(book.bids.length).toBeGreaterThan(0);
    }
  });

  it("cancels previous quotes instead of stacking them", () => {
    const runner = makeRunner();

    runner.tickMakers();
    const first = state.exchange.engine.snapshot("ACME", 20);

    for (let i = 0; i < 5; i += 1) {
      runner.tickMakers();
    }
    const later = state.exchange.engine.snapshot("ACME", 20);

    expect(later.bids.length).toBe(first.bids.length);
    expect(later.asks.length).toBe(first.asks.length);
  });

  it("drifts the anchor over repeated steps", () => {
    const maker = new MarketMaker(
      state,
      {
        userId: "mm_test",
        symbol: "ACME",
        anchorInCents: 5000,
        spreadInCents: 10,
        levels: 3,
        quantityPerLevel: 20,
        driftInCents: 15,
      },
      mulberry32(3)
    );

    const start = maker.currentAnchor;
    for (let i = 0; i < 20; i += 1) {
      maker.step(() => undefined);
    }

    expect(maker.currentAnchor).not.toBe(start);
  });

  it("keeps the anchor inside its bounds", () => {
    const maker = new MarketMaker(
      state,
      {
        userId: "mm_bounded",
        symbol: "ACME",
        anchorInCents: 5000,
        spreadInCents: 10,
        levels: 2,
        quantityPerLevel: 10,
        driftInCents: 400,
      },
      mulberry32(9)
    );

    for (let i = 0; i < 500; i += 1) {
      maker.step(() => undefined);
      expect(maker.currentAnchor).toBeGreaterThanOrEqual(3500);
      expect(maker.currentAnchor).toBeLessThanOrEqual(6500);
    }
  });

  it("produces trades once noise traders run", () => {
    const runner = makeRunner(5);
    runner.tickMakers();

    for (let i = 0; i < 20; i += 1) {
      runner.tickNoise();
      runner.tickMakers();
    }

    expect(trades.length).toBeGreaterThan(0);
  });

  it("notifies on every change", () => {
    makeRunner().tickMakers();

    expect(changes.length).toBeGreaterThan(0);
    expect(new Set(changes)).toEqual(new Set(state.symbols()));
  });

  it("holds account invariants through sustained bot activity", () => {
    const runner = makeRunner(11);

    for (let i = 0; i < 50; i += 1) {
      runner.tickMakers();
      runner.tickNoise();
      state.exchange.accounts.assertInvariants();
    }
  });

  it("conserves cash and shares through sustained bot activity", () => {
    const runner = makeRunner(13);
    runner.tickMakers();

    const cashBefore = state.exchange.accounts.totalCash();
    const sharesBefore = state.exchange.accounts.totalShares("ACME");

    for (let i = 0; i < 50; i += 1) {
      runner.tickNoise();
      runner.tickMakers();
    }

    expect(state.exchange.accounts.totalCash()).toBe(cashBefore);
    expect(state.exchange.accounts.totalShares("ACME")).toBe(sharesBefore);
  });

  it("behaves identically for the same seed", () => {
    const first = new ExchangeState(null);
    const second = new ExchangeState(null);

    for (const target of [first, second]) {
      const runner = new BotRunner({
        state: target,
        onChange: () => undefined,
        onTrades: () => undefined,
        random: mulberry32(21),
      });
      for (let i = 0; i < 20; i += 1) {
        runner.tickMakers();
        runner.tickNoise();
      }
    }

    expect(second.exchange.engine.digest()).toBe(first.exchange.engine.digest());
  });

  it("stops cleanly", () => {
    const runner = makeRunner();
    runner.start();
    runner.stop();
  });
});