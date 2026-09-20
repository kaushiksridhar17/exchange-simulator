import { buildServer } from "./server.js";

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";

async function main() {
  const { app, state } = await buildServer({ logger: true, bots: true });

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`Exchange API listening on http://localhost:${PORT}`);
    if (state.recovered > 0) {
      console.log(`Recovered ${state.recovered} commands from the event log`);
    }
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

main();