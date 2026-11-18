// @ts-check
import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const ROOT = import.meta.dirname;

// NFR-02: domain e application não tocam navegador, UI nem libs de infraestrutura.
const BROWSER_GLOBALS = [
  'window',
  'document',
  'navigator',
  'location',
  'history',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'fetch',
  'alert',
];
const NFR02 = 'NFR-02: domain/application não usam navegador, UI nem libs de infraestrutura.';

export default defineConfig(
  {
    ignores: [
      '**/node_modules/**',
      '**/.svelte-kit/**',
      '**/build/**',
      '**/dist/**',
      '**/coverage/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  svelte.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: ROOT,
        extraFileExtensions: ['.svelte'],
      },
    },
    rules: {
      // NFR-01: proibido `any`.
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    files: ['ui/src/**/*.{ts,svelte}'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['**/*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['packages/core/src/{domain,application}/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'svelte',
                'svelte/*',
                '@sveltejs/*',
                '@xyflow/*',
                'zod',
                'idb-keyval',
                '@dagrejs/*',
              ],
              message: NFR02,
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...BROWSER_GLOBALS.map((name) => ({ name, message: NFR02 })),
      ],
    },
  },
  // Fronteiras de camada (ADR-0001, item 3; SPEC §7).
  {
    files: ['packages/core/src/**/*.ts', 'ui/src/**/*.{ts,svelte}'],
    plugins: { boundaries },
    settings: {
      'boundaries/root-path': ROOT,
      'boundaries/elements': [
        { type: 'domain', pattern: 'packages/core/src/domain' },
        { type: 'application', pattern: 'packages/core/src/application' },
        { type: 'infrastructure', pattern: 'packages/core/src/infrastructure' },
        // packages/core/src/index.ts (API pública) fica sem classificação: a UI o importa como
        // `@graph-builder/core`; imports diretos de domain/application/infrastructure são barrados.
        { type: 'ui', pattern: 'ui/src' },
      ],
      'import/resolver': { node: { extensions: ['.ts', '.js', '.svelte'] } },
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            {
              from: { element: { type: 'domain' } },
              allow: { to: { element: { type: 'domain' } } },
            },
            {
              from: { element: { type: 'application' } },
              allow: { to: { element: { types: ['domain', 'application'] } } },
            },
            {
              from: { element: { type: 'infrastructure' } },
              allow: { to: { element: { types: ['domain', 'application', 'infrastructure'] } } },
            },
            {
              from: { element: { type: 'ui' } },
              allow: { to: { element: { type: 'ui' } } },
            },
          ],
        },
      ],
    },
  },
);
