import globals from 'globals';
import tsParser from '@typescript-eslint/parser';

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
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
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
      // warn, not error: this root config has no eslint-plugin-react, so
      // imports referenced only in JSX markup are false-positive "unused"
      // and would block every commit that stages a .jsx file.
      'no-unused-vars': 'warn',
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
  {
    // T07 gate: the new V2 domain/application boundaries (ports, models,
    // application services) must depend on repository ports — never on the
    // Firebase SDK. Legacy V1 `domain/services/*` and `domain/repositories/*`
    // are excluded (pre-existing firebase imports, migration debt).
    files: ['packages/core/src/**/*.ts'],
    ignores: [
      'packages/core/src/infrastructure/**',
      'packages/core/src/domain/services/**',
      'packages/core/src/domain/repositories/**',
      'packages/core/src/domain/auth/**',
      'packages/core/src/main.ts',
      'packages/core/src/client.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'firebase-admin/firestore',
              message:
                'firebase-admin is only allowed inside packages/core/src/infrastructure/** (T07 repository gate).',
            },
            {
              name: 'firebase-admin',
              message:
                'firebase-admin is only allowed inside packages/core/src/infrastructure/** (T07 repository gate).',
            },
          ],
        },
      ],
    },
  },
];
