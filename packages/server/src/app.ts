import { randomUUID } from 'node:crypto';
import {
  ReplayMismatchError,
  runReplay,
  stableStringify,
  type Replay,
  type SimulationConfig,
} from '@lzs/core';
import type { ContentBundle } from '@lzs/content';
import Fastify from 'fastify';
import pino, { type Logger } from 'pino';
import type { ServerConfig } from './environment.js';
import {
  fingerprintRequest,
  IdempotencyConflictError,
  InMemoryIdempotencyStore,
  type IdempotencyStore,
} from './idempotency.js';

export interface ReadinessCheck {
  readonly name: string;
  readonly status: 'ok' | 'error';
}

export interface BuildServerOptions {
  readonly config: ServerConfig;
  readonly bundle: ContentBundle;
  readonly idempotencyStore?: IdempotencyStore;
  readonly readinessProbe?: () => Promise<readonly ReadinessCheck[]>;
  readonly logger?: Logger;
}

interface ReplayRequest {
  Body: Replay;
  Headers: {
    'idempotency-key': string;
  };
}

class VersionMismatchError extends Error {
  public constructor() {
    super('回放版本与服务端版本不一致');
    this.name = 'VersionMismatchError';
  }
}

export function createLogger(config: ServerConfig): Logger {
  return pino({
    level: config.logLevel,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["idempotency-key"]',
        'DATABASE_URL',
        'REDIS_URL',
      ],
      censor: '[REDACTED]',
    },
  });
}

function assertVersionCompatibility(
  replay: Replay,
  config: ServerConfig,
  bundle: ContentBundle,
): void {
  const actual = replay.config.versions;
  const expected = {
    gameVersion: config.gameVersion,
    contentVersion: bundle.contentVersion,
    rulesVersion: bundle.rulesVersion,
    configHash: bundle.configHash,
  };
  if (stableStringify(actual) !== stableStringify(expected)) {
    throw new VersionMismatchError();
  }
}

export function buildServer(options: BuildServerOptions) {
  const { config, bundle } = options;
  if (config.idempotencyStore === 'postgres' && options.idempotencyStore === undefined) {
    throw new TypeError('postgres幂等模式必须提供PostgreSQL存储');
  }
  const idempotencyStore = options.idempotencyStore ?? new InMemoryIdempotencyStore();
  const app = Fastify({
    loggerInstance: options.logger ?? createLogger(config),
    genReqId: (request) => {
      const requestId = request.headers['x-request-id'];
      return typeof requestId === 'string' && /^[a-zA-Z0-9._-]{1,128}$/.test(requestId)
        ? requestId
        : randomUUID();
    },
  });

  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  app.get('/health/live', async () => ({ status: 'ok' }));
  app.get('/health/ready', async (_request, reply) => {
    const dependencyChecks = options.readinessProbe ? await options.readinessProbe() : [];
    const checks = [{ name: 'content', status: 'ok' } as const, ...dependencyChecks];
    const ready = checks.every((check) => check.status === 'ok');
    return reply.code(ready ? 200 : 503).send({ status: ready ? 'ready' : 'not_ready', checks });
  });
  app.get('/api/v1/version', async () => ({
    gameVersion: config.gameVersion,
    contentVersion: bundle.contentVersion,
    rulesVersion: bundle.rulesVersion,
    configHash: bundle.configHash,
    tickRate: bundle.tickRate,
  }));

  app.post<ReplayRequest>(
    '/api/v1/replays/verify',
    {
      schema: {
        headers: {
          type: 'object',
          required: ['idempotency-key'],
          properties: {
            'idempotency-key': { type: 'string', minLength: 1, maxLength: 128 },
          },
        },
        body: {
          type: 'object',
          required: ['config', 'totalTicks', 'commands', 'expectedHash'],
          properties: {
            config: { type: 'object' },
            totalTicks: { type: 'integer', minimum: 0, maximum: 18000 },
            commands: { type: 'array', maxItems: 100000 },
            expectedHash: { type: ['string', 'null'] },
          },
        },
      },
    },
    async (request) => {
      assertVersionCompatibility(request.body, config, bundle);
      const trustedConfig: SimulationConfig = {
        seed: request.body.config.seed,
        initialGrain: bundle.economy.initialGrain,
        barracksCapacity: bundle.economy.barracksCapacity,
        recruitCost: bundle.economy.recruitCost,
        deck: bundle.units.map((unit) => unit.name),
        versions: {
          gameVersion: config.gameVersion,
          contentVersion: bundle.contentVersion,
          rulesVersion: bundle.rulesVersion,
          configHash: bundle.configHash,
        },
      };
      const replay: Replay = { ...request.body, config: trustedConfig };
      const result = await idempotencyStore.execute(
        `replay-verify:${request.headers['idempotency-key']}`,
        fingerprintRequest(request.body),
        async () => runReplay(replay),
      );
      return {
        requestId: request.id,
        idempotentReplay: result.replayed,
        stateHash: result.value.stateHash,
        tick: result.value.snapshot.state.tick,
        eventCount: result.value.events.length,
        configHash: bundle.configHash,
      };
    },
  );

  app.setErrorHandler((error: unknown, request, reply) => {
    const isValidation = typeof error === 'object' && error !== null && 'validation' in error;
    let statusCode = 500;
    let code = 'INTERNAL_ERROR';
    let message = '服务内部错误';
    if (isValidation) {
      statusCode = 400;
      code = 'INVALID_REQUEST';
      message = '请求结构校验失败';
    } else if (error instanceof IdempotencyConflictError) {
      statusCode = 409;
      code = 'IDEMPOTENCY_CONFLICT';
      message = error.message;
    } else if (error instanceof VersionMismatchError) {
      statusCode = 409;
      code = 'VERSION_MISMATCH';
      message = error.message;
    } else if (error instanceof ReplayMismatchError) {
      statusCode = 422;
      code = 'REPLAY_MISMATCH';
      message = error.message;
    } else if (error instanceof TypeError || error instanceof RangeError) {
      statusCode = 400;
      code = 'INVALID_REPLAY';
      message = error.message;
    }
    if (statusCode === 500) {
      request.log.error({ err: error }, '未处理的服务错误');
    }
    return reply.code(statusCode).send({
      error: { code, message, requestId: request.id },
    });
  });

  return app;
}
