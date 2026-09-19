import type {
  AccountSummary,
  Order,
  OrderBookSnapshot,
  Trade,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string; message?: string };
      message = body.error ?? body.message ?? message;
    } catch {
      // response had no JSON body
    }
    throw new ApiError(message, response.status);
  }

  return (await response.json()) as T;
}

export function fetchSymbols(): Promise<{ symbols: string[] }> {
  return request("/symbols");
}

export function fetchBook(symbol: string): Promise<OrderBookSnapshot> {
  return request(`/book/${symbol}`);
}

export function fetchTrades(symbol: string): Promise<{ trades: Trade[] }> {
  return request(`/trades/${symbol}`);
}

export function fetchAccount(userId: string): Promise<AccountSummary> {
  return request(`/account/${encodeURIComponent(userId)}`);
}

export interface PlaceOrderInput {
  userId: string;
  symbol: string;
  side: "buy" | "sell";
  type: "limit" | "market";
  priceInCents?: number;
  quantity: number;
  maxNotionalInCents?: number;
}

export function placeOrder(
  input: PlaceOrderInput
): Promise<{ order: Order; trades: Trade[] }> {
  return request("/orders", { method: "POST", body: JSON.stringify(input) });
}

export function cancelOrder(orderId: string): Promise<{ order: Order }> {
  return request(`/orders/${orderId}`, { method: "DELETE" });
}