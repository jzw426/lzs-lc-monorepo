import type { Schema } from 'ajv';

export const contentBundleSchema: Schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  additionalProperties: false,
  required: ['contentVersion', 'rulesVersion', 'configHash', 'tickRate', 'economy', 'units'],
  properties: {
    contentVersion: { type: 'string', minLength: 1, maxLength: 64 },
    rulesVersion: { type: 'string', minLength: 1, maxLength: 64 },
    configHash: { type: 'string', pattern: '^fnv1a32:[0-9a-f]{8}$' },
    tickRate: { const: 30 },
    economy: {
      type: 'object',
      additionalProperties: false,
      required: ['initialGrain', 'barracksCapacity', 'recruitCost'],
      properties: {
        initialGrain: { type: 'integer', minimum: 0, maximum: 1000000 },
        barracksCapacity: { type: 'integer', minimum: 1, maximum: 100 },
        recruitCost: { type: 'integer', minimum: 0, maximum: 1000000 },
      },
    },
    units: {
      type: 'array',
      minItems: 4,
      maxItems: 1000,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'name', 'attack', 'maxHealth'],
        properties: {
          id: { type: 'string', pattern: '^[a-z][a-z0-9_-]{0,63}$' },
          name: { enum: ['刀', '枪', '骑', '弓'] },
          attack: { type: 'integer', minimum: 0, maximum: 1000000 },
          maxHealth: { type: 'integer', minimum: 1, maximum: 1000000 },
        },
      },
    },
  },
};
