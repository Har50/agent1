import { buildServer } from './app.js';
import { config } from './config/env.js';
import { closeDb } from './db/client.js';

async function main() {
  const app = await buildServer();
  await app.listen({ port: config.PORT, host: config.HOST });
  app.log.info(
    `Base AI TX provider listening on ${config.HOST}:${config.PORT} (mode=${config.EXECUTION_MODE})`
  );

  const shutdown = async () => {
    await app.close();
    await closeDb();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
