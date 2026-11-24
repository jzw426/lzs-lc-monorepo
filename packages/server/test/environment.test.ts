import { describe, expect, it } from 'vitest';
import { loadServerEnvironment } from '../src/environment.js';

const production = {
  APP_ENV: 'production',
  GAME_VERSION: '1.0.0',
  DATABASE_URL: 'postgresql://user:password@db.internal/lzs',
  REDIS_URL: 'rediss://cache.internal',
};

describe('环境配置', () => {
  it('local提供安全默认值', () => {
    const config = loadServerEnvironment({ APP_ENV: 'local' });
    expect(config).toMatchObject({
      appEnv: 'local',
      host: '127.0.0.1',
      port: 3000,
      gameVersion: '0.1.0-m1',
      idempotencyStore: 'memory',
    });
  });

  it('production要求PostgreSQL幂等与独立依赖', () => {
    const config = loadServerEnvironment(production);
    expect(config.idempotencyStore).toBe('postgres');
    expect(config.databaseUrl).toContain('postgresql:');
    expect(config.redisUrl).toContain('rediss:');
  });

  it.each([
    [{ APP_ENV: 'invalid' }, 'APP_ENV'],
    [{ PORT: 'abc' }, 'PORT'],
    [{ PORT: '65536' }, 'PORT'],
    [{ HOST: '' }, 'HOST'],
    [{ APP_ENV: 'production' }, 'GAME_VERSION'],
    [{ ...production, IDEMPOTENCY_STORE: 'memory' }, 'postgres'],
    [{ ...production, DATABASE_URL: undefined }, 'DATABASE_URL'],
    [{ ...production, REDIS_URL: undefined }, 'REDIS_URL'],
    [{ DATABASE_URL: 'http://db.local' }, 'DATABASE_URL'],
    [{ REDIS_URL: 'http://cache.local' }, 'REDIS_URL'],
    [{ IDEMPOTENCY_STORE: 'postgres' }, 'DATABASE_URL'],
    [{ LOG_LEVEL: 'verbose' }, 'LOG_LEVEL'],
  ])('拒绝非法配置 %#', (source, message) => {
    expect(() => loadServerEnvironment(source)).toThrow(message as string);
  });

  it('校验可选OTLP地址并保留服务名', () => {
    expect(
      loadServerEnvironment({
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://collector:4318',
        OTEL_SERVICE_NAME: 'lzs-test',
      }),
    ).toMatchObject({ otlpEndpoint: 'http://collector:4318', serviceName: 'lzs-test' });
    expect(() =>
      loadServerEnvironment({ OTEL_EXPORTER_OTLP_ENDPOINT: 'file:///tmp/trace' }),
    ).toThrow('OTEL_EXPORTER_OTLP_ENDPOINT');
  });
});
