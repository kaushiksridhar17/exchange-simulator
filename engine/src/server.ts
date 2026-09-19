import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { registerRoutes } from "./api/routes.js";
import { registerWebSocket } from "./ws/routes.js";
import { Broadcaster } from "./ws/broadcaster.js";
import { BotRunner } from "./bots/runner.js";
import { ExchangeState } from "./exchangeState.js";
import type { Trade } from "./types.js";

export interface ServerOptions {
  logPath?: string | null;
  logger?: boolean;
  broadcastIntervalMs?: number;
  bots?: boolean;
}

export async function buildServer(options: ServerOptions = {}) {
  const logPath =
    options.logPath === undefined ? "data/events.jsonl" : options.logPath;
  const state = new ExchangeState(logPath);
  const broadcaster = new Broadcaster(state, options.broadcastIntervalMs ?? 100);
  const app = Fastify({ logger: options.logger ?? false });

  await app.register(cors, { origin: true });
  await app.register(websocket);

  const onChange = (symbol: string) => broadcaster.markDirty(symbol);
  const onTrades = (symbol: string, trades: Trade[]) =>
    broadcaster.publishTrades(symbol, trades);

  registerRoutes(app, { state, onOrderChange: onChange, onTrades });
  registerWebSocket(app, broadcaster);

  const bots = new BotRunner({ state, onChange, onTrades });
  if (options.bots) {
    bots.start();
  }

  app.addHook("onClose", async () => {
    bots.stop();
    broadcaster.stop();
    state.close();
  });

  return { app, state, broadcaster, bots };
}