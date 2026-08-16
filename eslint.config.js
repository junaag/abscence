import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
    },
  },
  {
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error',
        { name: 'window', message: 'The engine must stay runtime-agnostic.' },
        { name: 'document', message: 'The engine must not depend on the DOM.' },
        { name: 'localStorage', message: 'Inject a storage adapter instead.' },
      ],
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['../ui/*', '../../ui/*', '../../../ui/*'], message: 'Engine modules cannot depend on UI modules.' },
        ],
      }],
    },
  },
  {
    files: ['src/ui/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          { name: '../engine', message: 'UI code must use ../app/game-api, never the broad engine facade.' },
          { name: '../../engine', message: 'UI code must use the presentation-safe app game API.' },
        ],
        patterns: [
          { group: ['../engine/*', '../../engine/*'], message: 'UI code must use the presentation-safe app game API, not engine internals.' },
        ],
      }],
    },
  },
  { ignores: ['dist/**', 'coverage/**', 'playwright-report/**', 'test-results/**'] },
);
