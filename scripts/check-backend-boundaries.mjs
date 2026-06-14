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
];

function matchesGlob(file, pattern) {
  const rel = file.replace(/\\/g, '/');
  const regex = pattern
    .replace(/\*\*/g, '(.+)')
    .replace(/\*/g, '[^/]*')
    .replace(/\//g, '\\/');
  return new RegExp(`^${regex}$`).test(rel);
}

async function findViolations() {
  const files = glob.sync('**/*.{ts,tsx,js,jsx,mjs,cjs}', {
    cwd: ROOT,
    ignore: IGNORE_PATTERNS,
    nodir: true,
  });

  const pattern = /from\s+["']firebase-admin(?:\/[^"']*)?["']|require\s*\(\s*["']firebase-admin(?:\/[^"']*)?["']\s*\)/;
  const violations = [];

  for (const file of files) {
    const isAllowed = ALLOWED_PATTERNS.some(p => matchesGlob(file, p));
    if (isAllowed) continue;

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

async function main() {
  const violations = await findViolations();

  if (violations.length === 0) {
    console.log('✅ All backend boundary checks passed!');
    console.log('   firebase-admin only used in: packages/core, apps/api-gateway, functions\n');
    process.exit(0);
  }

  console.log(`❌ Found ${violations.length} unauthorized firebase-admin import(s):\n`);
  for (const v of violations) {
    console.log(`   ${v.file}:${v.line}`);
    console.log(`     → ${v.importLine}`);
  }
  console.log('\nfirebase-admin is ONLY allowed in: packages/core, apps/api-gateway, functions');
  console.log('Frontend apps (guest-portal, partner-dashboard, admin-console, mobile-app, scanner-app) must NOT use firebase-admin.\n');
  process.exit(1);
}

main().catch(err => {
  console.error('Guardrails check failed:', err);
  process.exit(1);
});
