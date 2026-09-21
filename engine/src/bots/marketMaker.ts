import type { ExchangeState } from "../exchangeState.js";
import type { Order } from "../types.js";

export interface MarketMakerConfig {
  userId: string;
  symbol: string;
  anchorInCents: number;
  spreadInCents: number;
  levels: number;
  quantityPerLevel: number;
  driftInCents: number;
}

export class MarketMaker {
  private anchor: number;
  private restingIds: string[] = [];
  private adopted = false;

  constructor(
    private readonly state: ExchangeState,
    private readonly config: MarketMakerConfig,
    private readonly random: () => number
  ) {
    this.anchor = config.anchorInCents;
    this.state.ensureAccount(config.userId);
  }

  get currentAnchor(): number {
    return this.anchor;
  }

  step(onChange: (symbol: string) => void): void {
    if (!this.adopted) {
      this.adoptExisting();
      this.adopted = true;
    }
    this.cancelResting();
    this.drift();
    this.quote(onChange);
  }

  private adoptExisting(): void {
    for (const order of this.state.ordersFor(this.config.userId)) {
      if (
        order.symbol === this.config.symbol &&
        order.type === "limit" &&
        (order.status === "open" || order.status === "partially_filled")
      ) {
        this.restingIds.push(order.id);
      }
    }

    const lastTrade = this.state.recentTrades(this.config.symbol, 1)[0];
    if (lastTrade) {
      this.anchor = this.clamp(lastTrade.priceInCents);
    }
  }

  private drift(): void {
    const move = Math.round((this.random() - 0.5) * 2 * this.config.driftInCents);
    this.anchor = this.clamp(this.anchor + move);
  }

  private clamp(priceInCents: number): number {
    const floor = Math.round(this.config.anchorInCents * 0.7);
    const ceiling = Math.round(this.config.anchorInCents * 1.3);
    return Math.min(ceiling, Math.max(floor, priceInCents));
  }

  private cancelResting(): void {
    for (const orderId of this.restingIds) {
      this.state.cancelOrder(this.config.symbol, orderId);
    }
    this.restingIds = [];
  }

  private quote(onChange: (symbol: string) => void): void {
    const half = Math.max(1, Math.round(this.config.spreadInCents / 2));

    for (let level = 0; level < this.config.levels; level += 1) {
      const offset = half + level * this.config.spreadInCents;
      this.place("buy", this.anchor - offset);
      this.place("sell", this.anchor + offset);
    }

    onChange(this.config.symbol);
  }

  private place(side: "buy" | "sell", priceInCents: number): void {
    if (priceInCents <= 0) {
      return;
    }

    const order: Order = {
      id: this.state.nextOrderId(),
      userId: this.config.userId,
      symbol: this.config.symbol,
      side,
      type: "limit",
      priceInCents,
      maxNotionalInCents: null,
      quantity: this.config.quantityPerLevel,
      remainingQuantity: this.config.quantityPerLevel,
      status: "open",
      sequence: 0,
      createdAt: Date.now(),
    };

    try {
      const result = this.state.submitOrder(order);
      if (
        result.order.status === "open" ||
        result.order.status === "partially_filled"
      ) {
        this.restingIds.push(result.order.id);
      }
    } catch {
      return;
    }
  }
}