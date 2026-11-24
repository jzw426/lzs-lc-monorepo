import { describe, expect, it } from 'vitest';
import {
  fingerprintRequest,
  IdempotencyConflictError,
  InMemoryIdempotencyStore,
} from '../src/idempotency.js';

describe('InMemoryIdempotencyStore', () => {
  it('并发与后续重试只执行一次操作', async () => {
    const store = new InMemoryIdempotencyStore();
    let executions = 0;
    const operation = async () => {
      executions += 1;
      return { value: 42 };
    };
    const [first, concurrent] = await Promise.all([
      store.execute('key', 'fingerprint', operation),
      store.execute('key', 'fingerprint', operation),
    ]);
    const repeated = await store.execute('key', 'fingerprint', operation);
    expect(executions).toBe(1);
    expect(first).toEqual({ value: { value: 42 }, replayed: false });
    expect(concurrent).toEqual({ value: { value: 42 }, replayed: true });
    expect(repeated).toEqual({ value: { value: 42 }, replayed: true });
  });

  it('相同键不同请求指纹明确冲突', async () => {
    const store = new InMemoryIdempotencyStore();
    await store.execute('key', 'first', async () => 'ok');
    await expect(store.execute('key', 'second', async () => 'bad')).rejects.toBeInstanceOf(
      IdempotencyConflictError,
    );
  });

  it('失败操作不占用幂等键，可修复后重试', async () => {
    const store = new InMemoryIdempotencyStore();
    await expect(
      store.execute('key', 'fingerprint', async () => {
        throw new Error('temporary');
      }),
    ).rejects.toThrow('temporary');
    await expect(store.execute('key', 'fingerprint', async () => 'ok')).resolves.toEqual({
      value: 'ok',
      replayed: false,
    });
  });

  it('请求指纹不受对象键顺序影响', () => {
    expect(fingerprintRequest({ a: 1, b: 2 })).toBe(fingerprintRequest({ b: 2, a: 1 }));
    expect(fingerprintRequest({ a: 1 })).not.toBe(fingerprintRequest({ a: 2 }));
  });
});
