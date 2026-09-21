import type { ExchangeState } from "../exchangeState.js";
import type { Order, Side, Trade } from "../types.js";

export interface NoiseTraderConfig {
  userId: string;
  symbol: string;
  maxQuantity: number;
  tradeProbability: number;
}

export class NoiseTrader {
  constructor(
    private readonly state: ExchangeState,
    private readonly config: NoiseTraderConfig,
    private readonly random: () => number
  ) {
    this.state.ensureAccount(config.userId);
  }

  step(
    onChange: (symbol: string) => void,
    onTrades: (symbol: string, trades: Trade[]) => void
  ): void {
    if (this.random() > this.config.tradeProbability) {
      return;
    }

    const side: Side = this.random() < 0.5 ? "buy" : "sell";
    const quantity = 1 + Math.floor(this.random() * this.config.maxQuantity);
    const book = this.state.exchange.engine.snapshot(this.config.symbol, 1);
    const reference =
      side === "buy" ? book.asks[0]?.priceInCents : book.bids[0]?.priceInCents;

    if (reference === undefined) {
      return;
    }

    const order: Order = {
      id: this.state.nextOrderId(),
      userId: this.config.userId,
      symbol: this.config.symbol,
      side,
      type: "market",
      priceInCents: null,
      maxNotionalInCents:
        side === "buy" ? Math.round(reference * quantity * 1.5) : null,
      quantity,
      remainingQuantity: quantity,
      status: "open",
      sequence: 0,
      createdAt: Date.now(),
    };

    try {
      const result = this.state.submitOrder(order);

      onChange(this.config.symbol);
      if (result.trades.length > 0) {
        onTrades(this.config.symbol, result.trades);
      }
    } catch {
      return;
    }
  }
}