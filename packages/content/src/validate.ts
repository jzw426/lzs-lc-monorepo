import { Ajv, type ErrorObject, type ValidateFunction } from 'ajv';
import { computeConfigHash } from './hash.js';
import { contentBundleSchema } from './schema.js';
import type { ContentBundle } from './types.js';

function formatErrors(errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map(
    (error) => `${error.instancePath || '/'} ${error.message ?? '校验失败'}`,
  );
}

export class ContentValidationError extends Error {
  public constructor(public readonly issues: readonly string[]) {
    super(`内容校验失败：${issues.join('；')}`);
    this.name = 'ContentValidationError';
  }
}

export function createContentValidator(): ValidateFunction<ContentBundle> {
  const ajv = new Ajv({ allErrors: true, strict: true });
  return ajv.compile<ContentBundle>(contentBundleSchema);
}

export function validateContentBundle(input: unknown): ContentBundle {
  const validate = createContentValidator();
  if (!validate(input)) {
    throw new ContentValidationError(formatErrors(validate.errors));
  }
  const bundle = input;
  const issues: string[] = [];
  const ids = bundle.units.map((unit) => unit.id);
  if (new Set(ids).size !== ids.length) {
    issues.push('/units 单位ID必须唯一');
  }
  const { configHash, ...hashInput } = bundle;
  const actualHash = computeConfigHash(hashInput);
  if (configHash !== actualHash) {
    issues.push(`/configHash 应为${actualHash}，实际为${configHash}`);
  }
  if (issues.length > 0) {
    throw new ContentValidationError(issues);
  }
  return bundle;
}
