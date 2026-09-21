# Exchange Simulator

A stock exchange built from scratch in TypeScript. Users and market-making bots trade fictional stocks against each other through a custom matching engine, with a live order book, real-time charts, and full crash recovery.

![Trading UI](docs/images/trading-ui.png)

## Architecture

```
Browser (Next.js)
   │ REST                      ▲ WebSocket (live book + trades)
   ▼                           │
Fastify API ──▶ Event log ──▶ Matching engine ──▶ Broadcaster
                (source of        │
                 truth)           ├──▶ Accounts (settle, release funds)
                                  ▼
                           Persistence queue ──▶ PostgreSQL
                           (batched, async)      (history, candles)
```

**Nothing in the order path waits on the database.** Orders are matched in memory and return immediately; trades are written to Postgres in the background. The event log, not the database, is the source of truth, so Postgres can always be rebuilt from it.

## How It Works

1. **Validate** the order, then **reserve** the cash or shares it could use. Orders the user can't afford are rejected and leave no trace.
2. **Log** the accepted order to an append-only event log.
3. **Match** it against the book using price-time priority: best price first, oldest order first at the same price.
4. **Settle** the trades between accounts and release any funds that are no longer needed.
5. **Broadcast** the trades and updated book to every connected browser.
6. **Persist** the trades and order updates to Postgres in batches.

On restart, the engine replays the event log to rebuild the exact same market, and only writes to Postgres what it doesn't already have.

## Key Design Choices

- **Integer cents, never floats**, so money can't be created or lost through rounding.
- **Sequence numbers, not timestamps**, decide which order came first, since two orders can share a millisecond.
- **Funds reserved at order placement**, so the same cash or shares can never be spent twice.
- **The log stores inputs, not outcomes.** Because the engine is deterministic, replaying the inputs reproduces the market exactly, verified with a SHA-256 digest.
- **Single-threaded matching**, the way real exchanges keep matching fair and predictable.
- **Batched, idempotent database writes.** Each batch commits its trades, orders and log position in one transaction, and replayed data never duplicates rows.
- **Book updates coalesced to 100 ms** so busy markets don't flood the browser.

## Performance

- **Matching engine:** 1,047,996 orders/sec, 0.60 µs median and 6.00 µs p99 latency per order
- **HTTP API:** 2,000 orders/sec sustained with zero errors, 514 µs median latency
- **Tests:** 144, including property-based tests over thousands of randomized order sequences

![Engine benchmark](docs/images/benchmark-engine.png)

Full methodology in [`engine/bench/results.md`](engine/bench/results.md).

## What Testing Found

- **Stuck shares:** the unfilled part of a partially filled market sell stayed locked forever. Fixed so funds stay locked only for orders actually resting in the book.
- **Crossed book after restart:** the market-making bot didn't recognize its own recovered orders and quoted on top of them, leaving the best bid above the best ask. Fixed by having the bot adopt its orders on startup.
- **Misleading benchmark:** an early load test showed the server collapsing, but server logs showed sub-millisecond handling throughout. The load generator was running out of network ports. Fixed with connection reuse.

Each is covered by a regression test.

## Running It

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
git clone https://github.com/kavyasridhar1501/exchange-simulator.git
cd exchange-simulator
docker compose up --build
```

Open **http://localhost:3000**. You start with $100,000 and 1,000 shares each of ACME, ZENX and ORBT, and the bots are already trading. Click any price in the order book to fill the order form.

```bash
docker compose down      # stop, keeping the market
docker compose down -v   # stop and wipe everything
```

## Testing

```bash
cd engine
npm install
npm test
```

To also run the Postgres integration tests:

```bash
docker compose up -d db
docker compose exec db createdb -U exchange exchange_test
TEST_DATABASE_URL=postgres://exchange:exchange@localhost:5432/exchange_test npm test
```

![Tests passing](docs/images/tests-passing.png)

## Repository Structure

```
├── docker-compose.yml     # Frontend, engine and Postgres
├── engine/
│   ├── src/               # Matching engine, accounts, event log, API, bots, database
│   └── bench/             # Benchmarks and results
└── frontend/              # Next.js trading UI
```

## Tech Stack

TypeScript, Node.js, Fastify, WebSockets, PostgreSQL, Next.js, React, Tailwind CSS, TradingView Lightweight Charts, Vitest, fast-check, k6, Docker
