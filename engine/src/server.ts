import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerRoutes } from "./api/routes.js";
import { ExchangeState } from "./exchangeState.js";

export interface ServerOptions {
  logPath?: string;
  logger?: boolean;
}

export async function buildServer(options: ServerOptions = {}) {
  const state = new ExchangeState(options.logPath ?? "data/events.jsonl");
  const app = Fastify({ logger: options.logger ?? false });

  await app.register(cors, { origin: true });
  registerRoutes(app, { state });

  app.addHook("onClose", async () => {
    state.close();
  });

  return { app, state };
}