import { spawnSync } from 'node:child_process';

const skipHusky =
  process.env.HUSKY === '0' ||
  process.env.HUSKY === 'false' ||
  process.env.CI === 'true' ||
  process.env.RENDER === 'true' ||
  process.env.NODE_ENV === 'production' ||
  process.env.npm_config_production === 'true' ||
  (process.env.npm_config_omit || '').split(',').includes('dev');

if (skipHusky) {
  console.log('Skipping Husky install outside local development.');
  process.exit(0);
}

const result = spawnSync('npx', ['--no-install', 'husky'], {
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

if (result.error) {
  console.warn(`Skipping Husky install: ${result.error.message}`);
  process.exit(0);
}

process.exit(result.status ?? 1);
