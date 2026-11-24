import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      all: true,
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/types.ts'],
      reporter: ['text', 'json-summary', 'html'],
      thresholds: {
        statements: 90,
        lines: 90,
        functions: 90,
        branches: 85,
        'src/recruitment.ts': {
          statements: 100,
          lines: 100,
          functions: 100,
          branches: 100,
        },
      },
    },
  },
});
