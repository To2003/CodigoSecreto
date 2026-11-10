// @ts-check
import js from '@eslint/js';
import eslintReact from '@eslint-react/eslint-plugin';
import prettier from 'eslint-config-prettier';
import i18next from 'eslint-plugin-i18next';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', '**/.vite/**'] },

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // Conflicts with no-non-null-assertion (strict): one asks for `!`, the other forbids it.
      // We keep the strict rule and allow a commented `as` for proven invariants.
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
    },
  },

  // Plain JS (configs, scripts): no type information.
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      globals: globals.node,
    },
  },

  // Server: Node.
  {
    files: ['apps/server/**/*.ts'],
    languageOptions: { globals: globals.node },
  },

  // Web: React + browser. All visible copy lives in src/i18n/es-AR.ts (CLAUDE.md, SPEC §3.5).
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    ...eslintReact.configs['recommended-type-checked'],
    languageOptions: {
      ...eslintReact.configs['recommended-type-checked'].languageOptions,
      globals: globals.browser,
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    ...reactHooks.configs.flat['recommended-latest'],
  },
  {
    files: ['apps/web/src/**/*.tsx'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          // JSX text, string expressions ({'…'}) and the attributes people read or hear.
          mode: 'jsx-only',
          'jsx-attributes': {
            include: [
              'placeholder',
              'title',
              'alt',
              'label',
              'aria-label',
              'aria-description',
              'aria-placeholder',
              'aria-roledescription',
              'aria-valuetext',
            ],
            // Every other attribute (className, SVG geometry, data-*, …) is not copy.
            exclude: ['.*'],
          },
        },
      ],
    },
  },

  prettier,
);
