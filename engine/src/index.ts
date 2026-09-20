import { buildServer } from "./server.js";

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";
const LOGGER = process.env.LOGGER !== "false";
const BOTS = process.env.BOTS !== "false";

async function main() {
  const { app, state } = await buildServer({ logger: LOGGER, bots: BOTS });

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`Exchange API listening on http://localhost:${PORT}`);
    console.log(`logger=${LOGGER} bots=${BOTS}`);
    if (state.recovered > 0) {
      console.log(`Recovered ${state.recovered} commands from the event log`);
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, async () => {
      await app.close();
      process.exit(0);
    });
  }
}

main();