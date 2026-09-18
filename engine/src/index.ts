import type { Order } from "./types.js";

const order: Order = {
  id: "ord_1",
  userId: "user_1",
  symbol: "ACME",
  side: "buy",
  type: "limit",
  priceInCents: 5025,
  quantity: 100,
  remainingQuantity: 100,
  status: "open",
  sequence: 1,
  createdAt: Date.now(),
};

console.log(order);