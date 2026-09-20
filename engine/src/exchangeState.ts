import { Exchange } from "./exchange.js";
import { FileEventLog, type LogEntry } from "./eventLog.js";
import type { Order, Trade } from "./types.js";

const SYMBOLS = ["ACME", "ZENX", "ORBT"];
const STARTING_CASH = 100_000_00;
const STARTING_SHARES = 1000;

export class ExchangeState {
  readonly exchange: Exchange;
  private readonly log: FileEventLog | null;
  private orders = new Map<string, Order>();
  private trades: Trade[] = [];
  private orderCounter = 0;
  private recoveredCount = 0;

  constructor(logPath: string | null) {
    this.log = logPath === null ? null : new FileEventLog(logPath);
    this.exchange = new Exchange(null);

    if (this.log !== null) {
      this.recover(this.log.readAll());
      this.exchange.attachLog(this.log);
    }
  }

  get recovered(): number {
    return this.recoveredCount;
  }

  symbols(): string[] {
    return [...SYMBOLS];
  }

  isValidSymbol(symbol: string): boolean {
    return SYMBOLS.includes(symbol);
  }

  ensureAccount(userId: string): void {
    if (this.exchange.accounts.has(userId)) {
      return;
    }
    const isBot = userId.startsWith("mm_") || userId.startsWith("noise_");
    const cash = isBot ? STARTING_CASH * 500 : STARTING_CASH;
    const shares = isBot ? STARTING_SHARES * 500 : STARTING_SHARES;

    this.exchange.accounts.open(userId, cash);
    for (const symbol of SYMBOLS) {
      this.exchange.accounts.credit(userId, symbol, shares);
    }
  }

  nextOrderId(): string {
    this.orderCounter += 1;
    return `ord_${this.orderCounter}`;
  }

  recordOrder(order: Order): void {
    this.orders.set(order.id, order);
  }

  recordTrades(trades: Trade[]): void {
    this.trades.push(...trades);
    if (this.trades.length > 5000) {
      this.trades = this.trades.slice(-5000);
    }
  }

  getOrder(orderId: string): Order | null {
    return this.orders.get(orderId) ?? null;
  }

  ordersFor(userId: string): Order[] {
    return [...this.orders.values()].filter((order) => order.userId === userId);
  }

  recentTrades(symbol: string, limit = 50): Trade[] {
    return this.trades
      .filter((trade) => trade.symbol === symbol)
      .slice(-limit)
      .reverse();
  }

  close(): void {
    this.log?.close();
  }

  private recover(entries: LogEntry[]): void {
    let highestCounter = 0;

    for (const entry of entries) {
      const command = entry.command;

      if (command.kind === "cancel") {
        this.exchange.cancel(command.symbol, command.orderId);
        continue;
      }

      const order = structuredClone(command.order);
      const match = /^ord_(\d+)$/.exec(order.id);
      if (match) {
        highestCounter = Math.max(highestCounter, Number(match[1]));
      }

      this.ensureAccount(order.userId);

      try {
        const result = this.exchange.submit(order);
        this.recordOrder(result.order);
        this.recordTrades(result.trades);
      } catch {
        continue;
      }
    }

    this.orderCounter = highestCounter;
    this.recoveredCount = entries.length;
  }
}