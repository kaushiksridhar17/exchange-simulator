import type { Trade } from "./types";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export const BUCKET_SECONDS = 5;

function bucketFor(epochMs: number): number {
  return Math.floor(epochMs / 1000 / BUCKET_SECONDS) * BUCKET_SECONDS;
}

export function buildCandles(trades: Trade[]): Candle[] {
  if (trades.length === 0) {
    return [];
  }

  const ordered = [...trades].sort((a, b) => a.sequence - b.sequence);
  const byBucket = new Map<number, Candle>();

  for (const trade of ordered) {
    const time = bucketFor(trade.executedAt);
    const price = trade.priceInCents / 100;
    const existing = byBucket.get(time);

    if (!existing) {
      byBucket.set(time, {
        time,
        open: price,
        high: price,
        low: price,
        close: price,
      });
      continue;
    }

    existing.high = Math.max(existing.high, price);
    existing.low = Math.min(existing.low, price);
    existing.close = price;
  }

  return [...byBucket.values()].sort((a, b) => a.time - b.time);
}