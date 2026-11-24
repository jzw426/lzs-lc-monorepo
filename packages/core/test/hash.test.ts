import { describe, expect, it } from 'vitest';
import { fnv1a32, hashState, stableStringify } from '../src/hash.js';

describe('确定性hash', () => {
  it('对象键顺序不影响结果，数组顺序仍参与结果', () => {
    const left = { b: [1, 2], a: '鲁智深' };
    const right = { a: '鲁智深', b: [1, 2] };
    expect(stableStringify(left)).toBe(stableStringify(right));
    expect(hashState(left)).toBe(hashState(right));
    expect(hashState({ b: [2, 1], a: '鲁智深' })).not.toBe(hashState(left));
    expect(fnv1a32('abc')).toMatch(/^fnv1a32:[0-9a-f]{8}$/);
  });

  it('忽略对象中的undefined以兼容JSON序列化', () => {
    expect(stableStringify({ a: undefined, b: 1 })).toBe('{"b":1}');
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])('拒绝非有限数字 %s', (value) => {
    expect(() => hashState({ value })).toThrow(TypeError);
  });

  it('拒绝JSON之外的值', () => {
    expect(() => stableStringify(undefined)).toThrow(TypeError);
    expect(() => stableStringify(1n)).toThrow(TypeError);
    expect(() => stableStringify(() => true)).toThrow(TypeError);
  });
});
