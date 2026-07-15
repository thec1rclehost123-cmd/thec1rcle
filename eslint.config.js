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
      'no-unused-vars': 'error',
      'no-undef': 'error',
    },
  },
];
