import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/.turbo/**',
      '**/build/**',
      '**/coverage/**',
    ],
  },
  {
    languageOptions: {
      // This root config is what lint-staged's repo-root `eslint --fix`
      // resolves to for any staged file not covered by a more specific
      // workspace eslint.config (e.g. apps/guest-portal's, which pulls in
      // eslint-config-next for its own browser globals). Without these,
      // every window/fetch/document/process/etc. reference in a plain .js
      // file anywhere in the monorepo fails no-undef on commit.
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': 'error',
      'no-undef': 'error',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off',
    },
  },
];
