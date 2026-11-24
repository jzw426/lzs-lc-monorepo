export type AppEnvironment = 'local' | 'test' | 'staging' | 'production';
export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

export interface ServerConfig {
  readonly appEnv: AppEnvironment;
  readonly host: string;
  readonly port: number;
  readonly logLevel: LogLevel;
  readonly gameVersion: string;
  readonly idempotencyStore: 'memory' | 'postgres';
  readonly databaseUrl: string | null;
  readonly redisUrl: string | null;
  readonly otlpEndpoint: string | null;
  readonly serviceName: string;
}

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

function readEnum<T extends string>(
  source: EnvironmentSource,
  name: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = source[name] ?? fallback;
  if (!allowed.includes(value as T)) {
    throw new TypeError(`${name}只允许${allowed.join('/')}`);
  }
  return value as T;
}

function readUrl(
  value: string | undefined,
  name: string,
  protocols: readonly string[],
): string | null {
  if (value === undefined || value.length === 0) {
    return null;
  }
  const parsed = new URL(value);
  if (!protocols.includes(parsed.protocol)) {
    throw new TypeError(`${name}协议只允许${protocols.join('/')}`);
  }
  return value;
}

export function loadServerEnvironment(source: EnvironmentSource = process.env): ServerConfig {
  const appEnv = readEnum(source, 'APP_ENV', ['local', 'test', 'staging', 'production'], 'local');
  const isProductionLike = appEnv === 'staging' || appEnv === 'production';
  const portText = source.PORT ?? '3000';
  if (!/^\d+$/.test(portText)) {
    throw new TypeError('PORT必须是整数');
  }
  const port = Number(portText);
  if (port < 1 || port > 65535) {
    throw new RangeError('PORT必须在1到65535之间');
  }
  const host = source.HOST ?? '127.0.0.1';
  const gameVersion = source.GAME_VERSION ?? (isProductionLike ? '' : '0.1.0-m1');
  if (host.length === 0 || gameVersion.length === 0) {
    throw new TypeError('HOST与GAME_VERSION不得为空');
  }
  const idempotencyStore = readEnum(
    source,
    'IDEMPOTENCY_STORE',
    ['memory', 'postgres'],
    isProductionLike ? 'postgres' : 'memory',
  );
  if (isProductionLike && idempotencyStore !== 'postgres') {
    throw new TypeError('staging/production必须使用postgres幂等存储');
  }
  const databaseUrl = readUrl(source.DATABASE_URL, 'DATABASE_URL', ['postgres:', 'postgresql:']);
  const redisUrl = readUrl(source.REDIS_URL, 'REDIS_URL', ['redis:', 'rediss:']);
  if ((isProductionLike || idempotencyStore === 'postgres') && databaseUrl === null) {
    throw new TypeError('postgres幂等存储及staging/production必须配置DATABASE_URL');
  }
  if (isProductionLike && redisUrl === null) {
    throw new TypeError('staging/production必须配置REDIS_URL');
  }
  const otlpEndpoint = readUrl(source.OTEL_EXPORTER_OTLP_ENDPOINT, 'OTEL_EXPORTER_OTLP_ENDPOINT', [
    'http:',
    'https:',
  ]);
  return {
    appEnv,
    host,
    port,
    logLevel: readEnum(
      source,
      'LOG_LEVEL',
      ['fatal', 'error', 'warn', 'info', 'debug', 'trace'],
      'info',
    ),
    gameVersion,
    idempotencyStore,
    databaseUrl,
    redisUrl,
    otlpEndpoint,
    serviceName: source.OTEL_SERVICE_NAME ?? 'lzs-server',
  };
}
