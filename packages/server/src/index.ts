import { loadBaselineBundle } from '@lzs/content/node';
import { buildServer, createLogger } from './app.js';
import { createRuntimeDependencies } from './dependencies.js';
import { loadServerEnvironment } from './environment.js';
import { startTelemetry } from './telemetry.js';

export { buildServer } from './app.js';
export type { BuildServerOptions, ReadinessCheck } from './app.js';
export { createRuntimeDependencies } from './dependencies.js';
export { loadServerEnvironment } from './environment.js';
export type { ServerConfig } from './environment.js';
export {
  fingerprintRequest,
  IdempotencyConflictError,
  InMemoryIdempotencyStore,
  PostgresIdempotencyStore,
} from './idempotency.js';

async function main(): Promise<void> {
  const config = loadServerEnvironment();
  const logger = createLogger(config);
  const telemetry = startTelemetry(config);
  const bundle = loadBaselineBundle();
  const dependencies = await createRuntimeDependencies(config, logger);
  const app = buildServer({
    config,
    bundle,
    logger,
    readinessProbe: dependencies.checkReadiness,
    ...(dependencies.idempotencyStore ? { idempotencyStore: dependencies.idempotencyStore } : {}),
  });
  app.addHook('onClose', async () => {
    await dependencies.close();
    await telemetry.shutdown();
  });
  await app.listen({ host: config.host, port: config.port });

  const shutdown = () => {
    void app.close().catch((error: unknown) => {
      logger.error({ err: error }, '服务关闭失败');
      process.exitCode = 1;
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : '服务启动失败'}\n`);
  process.exitCode = 1;
});
