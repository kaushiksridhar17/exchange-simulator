"use client";

import { useEffect, useState } from "react";
import { fetchSymbols } from "@/lib/api";
import { useExchangeSocket } from "@/lib/useExchangeSocket";
import { centsToDollars, formatTime } from "@/lib/format";

export default function Home() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [symbol, setSymbol] = useState("ACME");
  const { status, book, trades } = useExchangeSocket(symbol);

  useEffect(() => {
    fetchSymbols()
      .then((result) => setSymbols(result.symbols))
      .catch(() => setSymbols([]));
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-slate-100">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Exchange</h1>
          <span className="text-sm text-slate-400">
            connection: {status}
          </span>
        </header>

        <div className="flex gap-2">
          {symbols.map((option) => (
            <button
              key={option}
              onClick={() => setSymbol(option)}
              className={`rounded px-3 py-1 text-sm ${
                option === symbol
                  ? "bg-slate-100 text-slate-900"
                  : "bg-slate-800 text-slate-300"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        <section className="rounded border border-slate-800 p-4">
          <h2 className="mb-3 text-sm uppercase tracking-wide text-slate-400">
            Order book
          </h2>
          {book === null ? (
            <p className="text-slate-500">waiting for data</p>
          ) : (
            <div className="grid grid-cols-2 gap-6 font-mono text-sm">
              <div>
                <p className="mb-2 text-emerald-400">bids</p>
                {book.bids.map((level) => (
                  <p key={level.priceInCents}>
                    {centsToDollars(level.priceInCents)} × {level.totalQuantity}
                  </p>
                ))}
              </div>
              <div>
                <p className="mb-2 text-rose-400">asks</p>
                {book.asks.map((level) => (
                  <p key={level.priceInCents}>
                    {centsToDollars(level.priceInCents)} × {level.totalQuantity}
                  </p>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded border border-slate-800 p-4">
          <h2 className="mb-3 text-sm uppercase tracking-wide text-slate-400">
            Recent trades
          </h2>
          {trades.length === 0 ? (
            <p className="text-slate-500">no trades yet</p>
          ) : (
            <div className="space-y-1 font-mono text-sm">
              {trades.slice(0, 15).map((trade) => (
                <p key={trade.id}>
                  <span
                    className={
                      trade.takerSide === "buy"
                        ? "text-emerald-400"
                        : "text-rose-400"
                    }
                  >
                    {centsToDollars(trade.priceInCents)}
                  </span>{" "}
                  × {trade.quantity}{" "}
                  <span className="text-slate-500">
                    {formatTime(trade.executedAt)}
                  </span>
                </p>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}