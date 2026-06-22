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
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'off',
    },
  },
];
