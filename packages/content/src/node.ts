import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { validateContentBundle } from './validate.js';
import type { ContentBundle } from './types.js';

export function loadBaselineBundle(): ContentBundle {
  const require = createRequire(import.meta.url);
  const manifestPath = require.resolve('@lzs/content/baseline');
  const input: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));
  return validateContentBundle(input);
}
