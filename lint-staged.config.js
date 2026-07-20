export default {
  '*.{js,jsx,ts,tsx}': ['prettier --write', 'eslint --fix --max-warnings=-1'],
  '*.{json,md,yml,yaml,css,scss}': ['prettier --write'],
  '*.{mjs,cjs}': ['prettier --write', 'eslint --fix --max-warnings=-1'],
};
