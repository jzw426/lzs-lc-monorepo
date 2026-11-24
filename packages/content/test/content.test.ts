import { describe, expect, it } from 'vitest';
import { computeConfigHash } from '../src/hash.js';
import { loadBaselineBundle } from '../src/node.js';
import { ContentValidationError, validateContentBundle } from '../src/validate.js';
import type { ContentBundle } from '../src/types.js';

function clone(bundle: ContentBundle): ContentBundle {
  return JSON.parse(JSON.stringify(bundle)) as ContentBundle;
}

describe('内容基线', () => {
  it('可从包导出路径加载并通过全部校验', () => {
    const bundle = loadBaselineBundle();
    expect(bundle.tickRate).toBe(30);
    expect(bundle.units).toHaveLength(4);
    const { configHash, ...hashInput } = bundle;
    expect(configHash).toBe(computeConfigHash(hashInput));
  });

  it('拒绝Schema错误或额外字段', () => {
    const invalid = clone(loadBaselineBundle()) as unknown as Record<string, unknown>;
    invalid.extra = true;
    expect(() => validateContentBundle(invalid)).toThrow(ContentValidationError);
    expect(() => validateContentBundle(null)).toThrow('内容校验失败');
  });

  it('拒绝重复ID', () => {
    const invalid = clone(loadBaselineBundle());
    (invalid.units as { id: string }[])[1]!.id = 'dao';
    expect(() => validateContentBundle(invalid)).toThrow('单位ID必须唯一');
  });

  it('拒绝内容与hash不一致', () => {
    const invalid = clone(loadBaselineBundle());
    (invalid.economy as { initialGrain: number }).initialGrain += 1;
    expect(() => validateContentBundle(invalid)).toThrow('/configHash 应为');
  });

  it('hash函数拒绝不可序列化内容', () => {
    expect(() => computeConfigHash({ value: Number.NaN })).toThrow(TypeError);
    expect(() => computeConfigHash(undefined)).toThrow(TypeError);
  });
});
