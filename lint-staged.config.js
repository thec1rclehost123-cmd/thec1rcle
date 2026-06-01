export default {
  '*.{js,jsx,ts,tsx}': [
    'prettier --write',
    'eslint --fix --max-warnings=0',
  ],
  '*.{json,md,yml,yaml,css,scss}': ['prettier --write'],
  '*.{mjs,cjs}': ['prettier --write', 'eslint --fix --max-warnings=0'],
};
