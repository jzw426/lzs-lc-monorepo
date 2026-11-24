import type { RandomState } from './types.js';

const UINT32_RANGE = 0x1_0000_0000;

function rotateLeft(value: number, bits: number): number {
  return ((value << bits) | (value >>> (32 - bits))) >>> 0;
}

function splitMix32(state: number): { readonly state: number; readonly value: number } {
  const nextState = (state + 0x9e3779b9) >>> 0;
  let value = nextState;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad) >>> 0;
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97) >>> 0;
  return { state: nextState, value: (value ^ (value >>> 15)) >>> 0 };
}

function assertUint32(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new RangeError(`${name}必须是uint32`);
  }
}

/** xoshiro128**：所有运算均限定为32位，禁止表现层共享或推进此序列。 */
export class Xoshiro128StarStar {
  private state: RandomState;

  public constructor(seed: number) {
    assertUint32(seed, 'seed');
    let expansionState = seed;
    const values: number[] = [];
    for (let index = 0; index < 4; index += 1) {
      const expanded = splitMix32(expansionState);
      expansionState = expanded.state;
      values.push(expanded.value);
    }
    this.state = {
      a: values[0] as number,
      b: values[1] as number,
      c: values[2] as number,
      d: values[3] as number,
    };
    this.ensureNonZeroState();
  }

  public static fromState(state: RandomState): Xoshiro128StarStar {
    assertUint32(state.a, 'random.a');
    assertUint32(state.b, 'random.b');
    assertUint32(state.c, 'random.c');
    assertUint32(state.d, 'random.d');
    const random = new Xoshiro128StarStar(0);
    random.state = { ...state };
    random.ensureNonZeroState();
    return random;
  }

  public getState(): RandomState {
    return { ...this.state };
  }

  public nextUint32(): number {
    const current = this.state;
    const result = Math.imul(rotateLeft(Math.imul(current.b, 5) >>> 0, 7), 9) >>> 0;
    const shifted = (current.b << 9) >>> 0;

    let c = (current.c ^ current.a) >>> 0;
    let d = (current.d ^ current.b) >>> 0;
    const b = (current.b ^ c) >>> 0;
    const a = (current.a ^ d) >>> 0;
    c = (c ^ shifted) >>> 0;
    d = rotateLeft(d, 11);

    this.state = { a, b, c, d };
    return result;
  }

  public nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > UINT32_RANGE) {
      throw new RangeError('maxExclusive必须在1到2^32之间');
    }
    const acceptedRange = Math.floor(UINT32_RANGE / maxExclusive) * maxExclusive;
    let value: number;
    do {
      value = this.nextUint32();
    } while (value >= acceptedRange);
    return value % maxExclusive;
  }

  private ensureNonZeroState(): void {
    if ((this.state.a | this.state.b | this.state.c | this.state.d) === 0) {
      throw new RangeError('随机数状态不得全为0');
    }
  }
}
