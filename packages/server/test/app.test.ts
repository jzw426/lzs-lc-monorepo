import { loadBaselineBundle } from '@lzs/content/node';
import type { Replay, SimulationConfig } from '@lzs/core';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { buildServer } from '../src/app.js';
import { loadServerEnvironment } from '../src/environment.js';

const bundle = loadBaselineBundle();
const config = loadServerEnvironment({ APP_ENV: 'test', GAME_VERSION: '0.1.0-m1' });

function createReplay(): Replay {
  const simulationConfig: SimulationConfig = {
    seed: 42,
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
  return {
    config: simulationConfig,
    totalTicks: 2,
    commands: [{ type: 'recruit', tick: 0, sequence: 0, commandId: 'command-1' }],
    expectedHash: null,
  };
}

function createApp(readinessProbe?: () => Promise<never[]>) {
  return buildServer({
    config,
    bundle,
    logger: pino({ level: 'silent' }),
    ...(readinessProbe ? { readinessProbe } : {}),
  });
}

describe('服务基础接口', () => {
  it('提供存活、就绪、版本与requestId', async () => {
    const app = createApp();
    try {
      const live = await app.inject({ method: 'GET', url: '/health/live' });
      expect(live.statusCode).toBe(200);
      expect(live.json()).toEqual({ status: 'ok' });
      expect(live.headers['x-request-id']).toBeTypeOf('string');

      const ready = await app.inject({ method: 'GET', url: '/health/ready' });
      expect(ready.statusCode).toBe(200);
      expect(ready.json()).toEqual({
        status: 'ready',
        checks: [{ name: 'content', status: 'ok' }],
      });

      const version = await app.inject({
        method: 'GET',
        url: '/api/v1/version',
        headers: { 'x-request-id': 'test-request-1' },
      });
      expect(version.headers['x-request-id']).toBe('test-request-1');
      expect(version.json()).toMatchObject({
        gameVersion: config.gameVersion,
        contentVersion: bundle.contentVersion,
        configHash: bundle.configHash,
        tickRate: 30,
      });
    } finally {
      await app.close();
    }
  });

  it('依赖异常时就绪检查返回503', async () => {
    const app = buildServer({
      config,
      bundle,
      logger: pino({ level: 'silent' }),
      readinessProbe: async () => [{ name: 'database', status: 'error' as const }],
    });
    try {
      const response = await app.inject({ method: 'GET', url: '/health/ready' });
      expect(response.statusCode).toBe(503);
      expect(response.json().status).toBe('not_ready');
    } finally {
      await app.close();
    }
  });

  it('回放校验使用受信任配置并支持幂等重试', async () => {
    const app = createApp();
    try {
      const replay = createReplay();
      (replay.config as { initialGrain: number }).initialGrain = 999999;
      const request = {
        method: 'POST' as const,
        url: '/api/v1/replays/verify',
        headers: { 'idempotency-key': 'replay-key-1' },
        payload: replay,
      };
      const first = await app.inject(request);
      expect(first.statusCode).toBe(200);
      expect(first.json()).toMatchObject({
        idempotentReplay: false,
        tick: 2,
        eventCount: 1,
        configHash: bundle.configHash,
      });
      const second = await app.inject(request);
      expect(second.statusCode).toBe(200);
      expect(second.json().stateHash).toBe(first.json().stateHash);
      expect(second.json().idempotentReplay).toBe(true);

      const conflict = await app.inject({
        ...request,
        payload: { ...replay, totalTicks: 3 },
      });
      expect(conflict.statusCode).toBe(409);
      expect(conflict.json().error.code).toBe('IDEMPOTENCY_CONFLICT');
    } finally {
      await app.close();
    }
  });

  it('拒绝版本不一致与hash分歧', async () => {
    const app = createApp();
    try {
      const invalidVersion = createReplay();
      (invalidVersion.config.versions as { configHash: string }).configHash = 'fnv1a32:deadbeef';
      const versionResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/replays/verify',
        headers: { 'idempotency-key': 'version-key' },
        payload: invalidVersion,
      });
      expect(versionResponse.statusCode).toBe(409);
      expect(versionResponse.json().error.code).toBe('VERSION_MISMATCH');

      const mismatch = await app.inject({
        method: 'POST',
        url: '/api/v1/replays/verify',
        headers: { 'idempotency-key': 'mismatch-key' },
        payload: { ...createReplay(), expectedHash: 'fnv1a32:deadbeef' },
      });
      expect(mismatch.statusCode).toBe(422);
      expect(mismatch.json().error.code).toBe('REPLAY_MISMATCH');
    } finally {
      await app.close();
    }
  });

  it('拒绝缺失幂等键和非法命令', async () => {
    const app = createApp();
    try {
      const missingKey = await app.inject({
        method: 'POST',
        url: '/api/v1/replays/verify',
        payload: createReplay(),
      });
      expect(missingKey.statusCode).toBe(400);
      expect(missingKey.json().error.code).toBe('INVALID_REQUEST');

      const replay = createReplay();
      (replay.commands[0] as { tick: number }).tick = 99;
      const invalid = await app.inject({
        method: 'POST',
        url: '/api/v1/replays/verify',
        headers: { 'idempotency-key': 'invalid-key' },
        payload: replay,
      });
      expect(invalid.statusCode).toBe(400);
      expect(invalid.json().error.code).toBe('INVALID_REPLAY');
    } finally {
      await app.close();
    }
  });

  it('postgres模式不得静默回退内存幂等', () => {
    const postgresConfig = loadServerEnvironment({
      APP_ENV: 'production',
      GAME_VERSION: '1.0.0',
      DATABASE_URL: 'postgresql://db.internal/lzs',
      REDIS_URL: 'redis://cache.internal',
    });
    expect(() => buildServer({ config: postgresConfig, bundle })).toThrow('必须提供PostgreSQL存储');
  });
});
