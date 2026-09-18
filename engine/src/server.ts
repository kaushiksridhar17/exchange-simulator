import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerRoutes } from "./api/routes.js";
import { ExchangeState } from "./exchangeState.js";

export interface ServerOptions {
  logPath?: string | null;
  logger?: boolean;
}

export async function buildServer(options: ServerOptions = {}) {
  const logPath =
    options.logPath === undefined ? "data/events.jsonl" : options.logPath;
  const state = new ExchangeState(logPath);
  const app = Fastify({ logger: options.logger ?? false });

  await app.register(cors, { origin: true });
  registerRoutes(app, { state });

  app.addHook("onClose", async () => {
    state.close();
  });

  return { app, state };
}