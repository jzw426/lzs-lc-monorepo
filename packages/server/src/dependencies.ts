import { Pool } from 'pg';
import { createClient } from 'redis';
import type { Logger } from 'pino';
import type { ReadinessCheck } from './app.js';
import type { ServerConfig } from './environment.js';
import { PostgresIdempotencyStore, type IdempotencyStore } from './idempotency.js';

export interface RuntimeDependencies {
  readonly idempotencyStore: IdempotencyStore | undefined;
  readonly checkReadiness: () => Promise<readonly ReadinessCheck[]>;
  readonly close: () => Promise<void>;
}

export async function createRuntimeDependencies(
  config: ServerConfig,
  logger: Logger,
): Promise<RuntimeDependencies> {
  const pool = config.databaseUrl
    ? new Pool({ connectionString: config.databaseUrl, max: 10 })
    : null;
  const redis = config.redisUrl ? createClient({ url: config.redisUrl }) : null;
  if (redis) {
    redis.on('error', (error: unknown) => {
      logger.error({ err: error }, 'Redis客户端错误');
    });
    await redis.connect();
  }

  let idempotencyStore: IdempotencyStore | undefined;
  if (config.idempotencyStore === 'postgres') {
    if (pool === null) {
      throw new TypeError('PostgreSQL幂等存储缺少连接池');
    }
    idempotencyStore = new PostgresIdempotencyStore(pool);
  }

  return {
    idempotencyStore,
    checkReadiness: async () => {
      const checks: ReadinessCheck[] = [];
      if (pool) {
        try {
          await pool.query('SELECT 1');
          checks.push({ name: 'database', status: 'ok' });
        } catch {
          checks.push({ name: 'database', status: 'error' });
        }
      }
      if (redis) {
        try {
          checks.push({ name: 'redis', status: (await redis.ping()) === 'PONG' ? 'ok' : 'error' });
        } catch {
          checks.push({ name: 'redis', status: 'error' });
        }
      }
      return checks;
    },
    close: async () => {
      if (redis?.isOpen) {
        await redis.quit();
      }
      if (pool) {
        await pool.end();
      }
    },
  };
}
