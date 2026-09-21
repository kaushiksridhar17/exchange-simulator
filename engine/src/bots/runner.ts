import { MarketMaker } from "./marketMaker.js";
import { NoiseTrader } from "./noiseTrader.js";
import type { ExchangeState } from "../exchangeState.js";
import type { Trade } from "../types.js";

export interface BotRunnerOptions {
  state: ExchangeState;
  onChange: (symbol: string) => void;
  onTrades: (symbol: string, trades: Trade[]) => void;
  quoteIntervalMs?: number;
  noiseIntervalMs?: number;
  random?: () => number;
}

const ANCHORS: Record<string, number> = {
  ACME: 5000,
  ZENX: 12500,
  ORBT: 800,
};

const LEVELS = 8;
const QUANTITY_PER_LEVEL = 100;

export class BotRunner {
  private makers: MarketMaker[] = [];
  private noise: NoiseTrader[] = [];
  private timers: NodeJS.Timeout[] = [];

  constructor(private readonly options: BotRunnerOptions) {
    const random = options.random ?? Math.random;

    for (const symbol of options.state.symbols()) {
      const anchor = ANCHORS[symbol] ?? 5000;

      this.makers.push(
        new MarketMaker(
          options.state,
          {
            userId: `mm_${symbol.toLowerCase()}`,
            symbol,
            anchorInCents: anchor,
            spreadInCents: Math.max(2, Math.round(anchor * 0.002)),
            levels: LEVELS,
            quantityPerLevel: QUANTITY_PER_LEVEL,
            driftInCents: Math.max(1, Math.round(anchor * 0.003)),
          },
          random
        )
      );

      this.noise.push(
        new NoiseTrader(
          options.state,
          {
            userId: `noise_${symbol.toLowerCase()}`,
            symbol,
            maxQuantity: 15,
            tradeProbability: 0.6,
          },
          random
        )
      );
    }
  }

  start(): void {
    this.tickMakers();

    const quoteInterval = this.options.quoteIntervalMs ?? 3000;
    const noiseInterval = this.options.noiseIntervalMs ?? 1200;

    const quoteTimer = setInterval(() => this.tickMakers(), quoteInterval);
    const noiseTimer = setInterval(() => this.tickNoise(), noiseInterval);

    quoteTimer.unref();
    noiseTimer.unref();
    this.timers.push(quoteTimer, noiseTimer);
  }

  stop(): void {
    for (const timer of this.timers) {
      clearInterval(timer);
    }
    this.timers = [];
  }

  tickMakers(): void {
    for (const maker of this.makers) {
      maker.step(this.options.onChange);
    }
  }

  tickNoise(): void {
    for (const trader of this.noise) {
      trader.step(this.options.onChange, this.options.onTrades);
    }
  }
}