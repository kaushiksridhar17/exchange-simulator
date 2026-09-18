import { OrderBook } from "./orderBook.js";
import type { Order, Side } from "./types.js";

let sequence = 0;

function makeOrder(
  side: Side,
  priceInCents: number,
  quantity: number
): Order {
  sequence += 1;
  return {
    id: `ord_${sequence}`,
    userId: "user_1",
    symbol: "ACME",
    side,
    type: "limit",
    priceInCents,
    quantity,
    remainingQuantity: quantity,
    status: "open",
    sequence,
    createdAt: Date.now(),
  };
}

const book = new OrderBook("ACME");

book.addOrder(makeOrder("buy", 5000, 100));
book.addOrder(makeOrder("buy", 5025, 50));
book.addOrder(makeOrder("buy", 5025, 75));
book.addOrder(makeOrder("buy", 4975, 200));

book.addOrder(makeOrder("sell", 5100, 60));
book.addOrder(makeOrder("sell", 5050, 40));
book.addOrder(makeOrder("sell", 5075, 90));

console.log("Best bid:", book.bestBid());
console.log("Best ask:", book.bestAsk());
console.log(JSON.stringify(book.snapshot(sequence), null, 2));

const front = book.peekBestOrder("buy");
console.log("First in line at best bid:", front?.id, front?.quantity);