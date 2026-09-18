import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { registerRoutes } from "./api/routes.js";
import { registerWebSocket } from "./ws/routes.js";
import { Broadcaster } from "./ws/broadcaster.js";
import { ExchangeState } from "./exchangeState.js";

export interface ServerOptions {
  logPath?: string | null;
  logger?: boolean;
  broadcastIntervalMs?: number;
}

export async function buildServer(options: ServerOptions = {}) {
  const logPath =
    options.logPath === undefined ? "data/events.jsonl" : options.logPath;
  const state = new ExchangeState(logPath);
  const broadcaster = new Broadcaster(state, options.broadcastIntervalMs ?? 100);
  const app = Fastify({ logger: options.logger ?? false });

  await app.register(cors, { origin: true });
  await app.register(websocket);

  registerRoutes(app, {
    state,
    onOrderChange: (symbol) => broadcaster.markDirty(symbol),
    onTrades: (symbol, trades) => broadcaster.publishTrades(symbol, trades),
  });
  registerWebSocket(app, broadcaster);

  app.addHook("onClose", async () => {
    broadcaster.stop();
    state.close();
  });

  return { app, state, broadcaster };
}