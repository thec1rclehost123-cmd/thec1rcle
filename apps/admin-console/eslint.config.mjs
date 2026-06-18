import nextConfig from 'eslint-config-next';

export default [
  {
    ignores: ['.next/**', 'dist/**', 'node_modules/**', 'coverage/**', '.turbo/**'],
  },
  ...nextConfig,
  {
    languageOptions: {
      sourceType: 'module',
    },
    rules: {
      'react/no-unescaped-entities': 'off',
      '@next/next/no-img-element': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/refs': 'off',
      'import/no-anonymous-default-export': 'off',
      'jsx-a11y/alt-text': 'off',
    },
  },
];
