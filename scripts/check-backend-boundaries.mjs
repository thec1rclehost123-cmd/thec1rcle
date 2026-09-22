import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const glob = require('glob');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..') + '/';

const ALLOWED_PATTERNS = [
  'packages/core/**',
  'packages/core/dist/**',
  'apps/api-gateway/**',
  'functions/**',
  'scripts/**', // top-level project utility and admin scripts
  'apps/admin-console/**', // internal admin tool — firebase-admin is legitimate here
  'apps/*/scripts/**', // app-level seed and test-data scripts (not shipped code)
];

const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.next/**',
  '**/coverage/**',
  '**/.git/**',
  '**/*.d.ts',
  '**/*.map',
  '**/package-lock.json',
  '**/yarn.lock',
  'apps/mobile-app-backup/**', // backup snapshot — not deployed code
  '**/scratch/**', // local scratch and experimental files
];

function matchesGlob(file, pattern) {
  const rel = file.replace(/\\/g, '/');
  const regex = pattern.replace(/\*\*/g, '(.+)').replace(/\*/g, '[^/]*').replace(/\//g, '\\/');
  return new RegExp(`^${regex}$`).test(rel);
}

function loadExceptions() {
  try {
    const exceptionsPath = resolve(
      __dirname,
      '..',
      'governance',
      'backend-boundary-exceptions.json',
    );
    return JSON.parse(readFileSync(exceptionsPath, 'utf8'));
  } catch {
    return {};
  }
}

async function findViolations() {
  const exceptions = loadExceptions();
  const files = glob.sync('**/*.{ts,tsx,js,jsx,mjs,cjs}', {
    cwd: ROOT,
    ignore: IGNORE_PATTERNS,
    nodir: true,
  });

  const pattern =
    /from\s+["']firebase-admin(?:\/[^"']*)?["']|require\s*\(\s*["']firebase-admin(?:\/[^"']*)?["']\s*\)/;
  const violations = [];

  for (const file of files) {
    // Root-level utility scripts (no directory separator) are exempt
    if (!file.includes('/') && !file.includes('\\')) continue;

    const isAllowed = ALLOWED_PATTERNS.some((p) => matchesGlob(file, p));
    if (isAllowed) continue;

    const normalizedFile = file.replace(/\\/g, '/');
    if (normalizedFile in exceptions) continue;

    try {
      const content = readFileSync(`${ROOT}${file}`, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i]) && !lines[i].trim().startsWith('//')) {
          violations.push({ file, line: i + 1, importLine: lines[i].trim() });
        }
      }
    } catch {
      // skip unreadable files
    }
  }

  return violations;
}

/**
 * 🚫 Config-separation rule (T03): `packages/core/src/domain/**` must never
 * read `process.env`. All configuration is injected via `CoreConfig`.
 */
function findEnvInCoreDomainViolations() {
  const files = glob.sync('packages/core/src/domain/**/*.{ts,tsx,js,jsx}', {
    cwd: ROOT,
    ignore: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
    nodir: true,
  });

  const pattern = /process\.env/;
  const violations = [];

  for (const file of files) {
    try {
      const content = readFileSync(`${ROOT}${file}`, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (pattern.test(lines[i]) && !trimmed.startsWith('//') && !trimmed.startsWith('*')) {
          violations.push({ file, line: i + 1, importLine: trimmed });
        }
      }
    } catch {
      // skip unreadable files
    }
  }

  return violations;
}

async function main() {
  const violations = await findViolations();
  const envViolations = findEnvInCoreDomainViolations();

  if (violations.length === 0 && envViolations.length === 0) {
    console.log('✅ All backend boundary checks passed!');
    console.log(
      '   firebase-admin only used in: packages/core, apps/api-gateway, functions,\n' +
        '   scripts/, apps/admin-console, app scripts dirs, and approved exceptions\n',
    );
    console.log(
      '   process.env not read inside packages/core/src/domain/** (config is injected)\n',
    );
    process.exit(0);
  }

  if (violations.length > 0) {
    console.log(`❌ Found ${violations.length} unauthorized firebase-admin import(s):\n`);
    for (const v of violations) {
      console.log(`   ${v.file}:${v.line}`);
      console.log(`     → ${v.importLine}`);
    }
    console.log('\nfirebase-admin is ONLY allowed in: packages/core, apps/api-gateway, functions,');
    console.log('scripts/, apps/admin-console, app-level scripts dirs, and files listed in');
    console.log('governance/backend-boundary-exceptions.json');
    console.log(
      'Frontend apps (guest-portal, partner-dashboard, mobile-app, scanner-app) must NOT use firebase-admin directly.\n',
    );
  }

  if (envViolations.length > 0) {
    console.log(
      `❌ Found ${envViolations.length} process.env read(s) in packages/core/src/domain:\n`,
    );
    for (const v of envViolations) {
      console.log(`   ${v.file}:${v.line}`);
      console.log(`     → ${v.importLine}`);
    }
    console.log(
      '\nConfig must be injected via CoreConfig; domain code never reads process.env directly.\n',
    );
  }

  process.exit(1);
}

main().catch((err) => {
  console.error('Guardrails check failed:', err);
  process.exit(1);
});
