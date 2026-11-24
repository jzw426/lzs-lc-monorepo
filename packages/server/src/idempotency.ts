import { createHash } from 'node:crypto';
import { stableStringify } from '@lzs/core';
import type { Pool } from 'pg';

export interface IdempotencyResult<T> {
  readonly value: T;
  readonly replayed: boolean;
}

export interface IdempotencyStore {
  execute<T>(
    key: string,
    fingerprint: string,
    operation: () => Promise<T>,
  ): Promise<IdempotencyResult<T>>;
}

export class IdempotencyConflictError extends Error {
  public constructor() {
    super('相同idempotencyKey不得用于不同请求');
    this.name = 'IdempotencyConflictError';
  }
}

export function fingerprintRequest(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

interface MemoryRecord {
  readonly fingerprint: string;
  readonly response: Promise<unknown>;
}

/** 单进程local/test实现；跨实例与生产环境必须使用PostgreSQL。 */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<string, MemoryRecord>();

  public async execute<T>(
    key: string,
    fingerprint: string,
    operation: () => Promise<T>,
  ): Promise<IdempotencyResult<T>> {
    const existing = this.records.get(key);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new IdempotencyConflictError();
      }
      return { value: (await existing.response) as T, replayed: true };
    }

    const response = Promise.resolve().then(operation);
    this.records.set(key, { fingerprint, response });
    try {
      return { value: await response, replayed: false };
    } catch (error) {
      if (this.records.get(key)?.response === response) {
        this.records.delete(key);
      }
      throw error;
    }
  }
}

export class PostgresIdempotencyStore implements IdempotencyStore {
  public constructor(private readonly pool: Pool) {}

  public async execute<T>(
    key: string,
    fingerprint: string,
    operation: () => Promise<T>,
  ): Promise<IdempotencyResult<T>> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
      const existing = await client.query<{
        fingerprint: string;
        response: T;
      }>('SELECT fingerprint, response FROM idempotency_records WHERE idempotency_key = $1', [key]);
      const record = existing.rows[0];
      if (record) {
        if (record.fingerprint !== fingerprint) {
          throw new IdempotencyConflictError();
        }
        await client.query('COMMIT');
        return { value: record.response, replayed: true };
      }
      const value = await operation();
      await client.query(
        `INSERT INTO idempotency_records (idempotency_key, fingerprint, response)
         VALUES ($1, $2, $3::jsonb)`,
        [key, fingerprint, JSON.stringify(value)],
      );
      await client.query('COMMIT');
      return { value, replayed: false };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
