import { MatchingEngine } from "./matchingEngine.js";
import type { Order, OrderType, Side } from "./types.js";

let counter = 0;

function makeOrder(
  userId: string,
  side: Side,
  type: OrderType,
  priceInCents: number | null,
  quantity: number
): Order {
  counter += 1;
  return {
    id: `ord_${counter}`,
    userId,
    symbol: "ACME",
    side,
    type,
    priceInCents,
    quantity,
    remainingQuantity: quantity,
    status: "open",
    sequence: 0,
    createdAt: Date.now(),
  };
}

const engine = new MatchingEngine();

engine.submit(makeOrder("alice", "sell", "limit", 5050, 100));
engine.submit(makeOrder("bob", "sell", "limit", 5075, 100));

console.log("Book before any match:");
console.log(JSON.stringify(engine.snapshot("ACME"), null, 2));

const partial = engine.submit(makeOrder("carol", "buy", "limit", 5050, 40));
console.log("\nPartial fill trades:", partial.trades);
console.log("Carol's order status:", partial.order.status);

const sweep = engine.submit(makeOrder("dave", "buy", "limit", 5100, 200));
console.log("\nSweep across levels:", sweep.trades.length, "trades");
for (const trade of sweep.trades) {
  console.log(`  ${trade.quantity} @ ${trade.priceInCents}`);
}
console.log("Dave's order status:", sweep.order.status);
console.log("Dave's remaining:", sweep.order.remainingQuantity);

console.log("\nBook after:");
console.log(JSON.stringify(engine.snapshot("ACME"), null, 2));