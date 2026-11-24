import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

const restrictedCoreImports = {
  patterns: [
    '@lzs/client*',
    '@lzs/server*',
    '@lzs/platform*',
    'layaair*',
    'node:*',
    'fs',
    'path',
    'http',
    'https',
    'crypto',
  ],
};

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      'node_modules/**',
      '.trae-html-share-packages/**',
      '.screenshots/**',
      'm1-p0-decision-baseline/**',
      'm1-foundation-acceptance/**',
      '**/*.html',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  prettier,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  {
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', restrictedCoreImports],
      'no-restricted-globals': ['error', 'window', 'document', 'tt', 'wx'],
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'core只接受显式逻辑tick' },
        { object: 'Math', property: 'random', message: 'core只使用显式种子随机数' },
      ],
    },
  },
  {
    files: ['packages/client/src/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['@lzs/server*', '@lzs/tools*'] }],
    },
  },
  {
    files: ['packages/server/src/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['@lzs/client*', '@lzs/platform*'] }],
    },
  },
  {
    files: ['packages/tools/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['@lzs/client*', '@lzs/server*', '@lzs/platform*'] },
      ],
    },
  },
  {
    files: ['packages/content/src/**/*.ts', 'packages/platform/src/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['@lzs/*'] }],
    },
  },
  {
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
