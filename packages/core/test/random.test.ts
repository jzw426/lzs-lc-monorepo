import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { Xoshiro128StarStar } from '../src/random.js';

const uint32 = fc.integer({ min: 0, max: 0xffffffff });

describe('Xoshiro128StarStar', () => {
  it('相同种子生成相同序列', () => {
    fc.assert(
      fc.property(uint32, (seed) => {
        const first = new Xoshiro128StarStar(seed);
        const repeated = new Xoshiro128StarStar(seed);
        for (let index = 0; index < 20; index += 1) {
          const value = first.nextUint32();
          expect(value).toBe(repeated.nextUint32());
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(0xffffffff);
        }
      }),
      { numRuns: 30 },
    );
  });

  it('可从状态恢复后续随机序列', () => {
    const original = new Xoshiro128StarStar(20260304);
    original.nextUint32();
    const restored = Xoshiro128StarStar.fromState(original.getState());
    expect(restored.getState()).toEqual(original.getState());
    for (let index = 0; index < 20; index += 1) {
      expect(restored.nextUint32()).toBe(original.nextUint32());
    }
  });

  it('nextInt保持整数范围并支持2^32上界', () => {
    fc.assert(
      fc.property(uint32, fc.integer({ min: 1, max: 1000 }), (seed, maximum) => {
        const random = new Xoshiro128StarStar(seed);
        for (let index = 0; index < 30; index += 1) {
          const value = random.nextInt(maximum);
          expect(Number.isInteger(value)).toBe(true);
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThan(maximum);
        }
        expect(random.nextInt(0x1_0000_0000)).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 30 },
    );
  });

  it.each([-1, 1.5, 0x1_0000_0000])('拒绝非法种子 %s', (seed) => {
    expect(() => new Xoshiro128StarStar(seed)).toThrow(RangeError);
  });

  it.each([0, -1, 1.5, 0x1_0000_0001])('拒绝非法取值上界 %s', (maximum) => {
    expect(() => new Xoshiro128StarStar(1).nextInt(maximum)).toThrow(RangeError);
  });

  it('拒绝非法或全零的恢复状态', () => {
    expect(() => Xoshiro128StarStar.fromState({ a: -1, b: 1, c: 2, d: 3 })).toThrow(RangeError);
    expect(() => Xoshiro128StarStar.fromState({ a: 1, b: 1.5, c: 2, d: 3 })).toThrow(RangeError);
    expect(() => Xoshiro128StarStar.fromState({ a: 1, b: 1, c: 0x1_0000_0000, d: 3 })).toThrow(
      RangeError,
    );
    expect(() => Xoshiro128StarStar.fromState({ a: 1, b: 1, c: 2, d: -1 })).toThrow(RangeError);
    expect(() => Xoshiro128StarStar.fromState({ a: 0, b: 0, c: 0, d: 0 })).toThrow(
      '随机数状态不得全为0',
    );
  });
});
