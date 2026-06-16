// Next.js/Expo workspace configs cause a circular plugin reference in ESLint v8
// when loaded cross-workspace. Root ESLint covers api-gateway, packages/core,
// functions, and scripts only. Each app workspace runs its own lint in CI.
const ROOT_ESLINT_PATTERN = /^(apps\/api-gateway|packages|functions|scripts)\//;

const eslintFiles = (files) => {
  const lintable = files.filter((f) => ROOT_ESLINT_PATTERN.test(f));
  if (!lintable.length) return [];
  return [`eslint --fix --max-warnings=0 ${lintable.join(' ')}`];
};

export default {
  '*.{js,jsx,ts,tsx}': ['prettier --write', eslintFiles],
  '*.{json,md,yml,yaml,css,scss}': ['prettier --write'],
  '*.{mjs,cjs}': ['prettier --write', eslintFiles],
};
