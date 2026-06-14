import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const glob = require('glob');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..') + '/';

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

function isIgnored(file) {
  return IGNORE_PATTERNS.some(p => {
    const pattern = p.replace(/\*\*/g, '(.+)?').replace(/\*/g, '[^/]*');
    const rel = file.replace(/\\/g, '/');
    return new RegExp(`^${pattern}$`).test(rel);
  });
}

function matchesGlob(file, pattern) {
  const rel = file.replace(/\\/g, '/');
  const regex = pattern
    .replace(/\*\*/g, '(.+)')
    .replace(/\*/g, '[^/]*')
    .replace(/\//g, '\\/');
  return new RegExp(`^${regex}$`).test(rel);
}

function loadExceptions() {
  const exceptionsPath = `${ROOT}governance/backend-boundary-exceptions.json`;
  if (!existsSync(exceptionsPath)) {
    console.error('ERROR: governance/backend-boundary-exceptions.json not found');
    process.exit(1);
  }
  return JSON.parse(readFileSync(exceptionsPath, 'utf8'));
}

async function findFirebaseAdminFiles() {
  const patterns = [
    '**/*.{ts,tsx,js,jsx,mjs,cjs}',
  ];

  const files = [];
  for (const pattern of patterns) {
    const matches = glob.sync(pattern, {
      cwd: ROOT,
      ignore: IGNORE_PATTERNS,
      nodir: true,
    });
    for (const f of matches) {
      if (!isIgnored(f)) {
        files.push(f);
      }
    }
  }

  const firebaseAdminPattern = /from\s+["']firebase-admin(?:\/[^"']*)?["']|require\s*\(\s*["']firebase-admin(?:\/[^"']*)?["']\s*\)/;
  const results = [];

  for (const file of files) {
    try {
      const content = readFileSync(`${ROOT}${file}`, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (firebaseAdminPattern.test(lines[i]) && !lines[i].trim().startsWith('//')) {
          results.push({ file, line: i + 1, importLine: lines[i].trim() });
        }
      }
    } catch {
      // skip unreadable files
    }
  }

  return results;
}

async function findGuestPortalRoutes() {
  const pattern = 'apps/guest-portal/app/api/**/route.{ts,tsx,js,jsx}';
  return glob.sync(pattern, {
    cwd: ROOT,
    ignore: IGNORE_PATTERNS,
    nodir: true,
  });
}

async function findPartnerDashboardFirebaseRoutes() {
  const files = glob.sync('apps/partner-dashboard/app/api/**/*.{ts,tsx,js,jsx}', {
    cwd: ROOT,
    ignore: IGNORE_PATTERNS,
    nodir: true,
  });

  const firebaseAdminPattern = /from\s+["']firebase-admin(?:\/[^"']*)?["']|require\s*\(\s*["']firebase-admin(?:\/[^"']*)?["']\s*\)/;
  const results = [];

  for (const file of files) {
    try {
      const content = readFileSync(`${ROOT}${file}`, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (firebaseAdminPattern.test(lines[i]) && !lines[i].trim().startsWith('//')) {
          results.push({ file, line: i + 1, importLine: lines[i].trim() });
        }
      }
    } catch {
      // skip
    }
  }

  return results;
}

function checkFirebaseAdminImports(files, exceptions) {
  const violations = [];
  const { allowed_patterns: allowedPatterns, exceptions: exceptionList } = exceptions.firebase_admin_imports;

  for (const { file, line, importLine } of files) {
    const isAllowed = allowedPatterns.some(p => matchesGlob(file, p));
    if (isAllowed) continue;

    const isExcepted = Object.keys(exceptionList).some(k => matchesGlob(file, k));
    if (isExcepted) continue;

    violations.push({ file, line, importLine });
  }

  return violations;
}

function checkGuestPortalRoutes(routes, exceptions) {
  const { approved_handlers: approved } = exceptions.guest_portal_api_routes;
  const violations = [];

  for (const route of routes) {
    const relativeRoute = route.replace(/^apps\/guest-portal\//, '');
    if (!approved.includes(relativeRoute)) {
      violations.push(route);
    }
  }

  return violations;
}

function checkPartnerDashboardRoutes(files, exceptions) {
  const { exceptions: partnerExceptions } = exceptions.partner_dashboard_firebase_admin_routes;
  const violations = [];

  for (const { file, line, importLine } of files) {
    const isExcepted = partnerExceptions.some(e => matchesGlob(file, e));
    if (!isExcepted) {
      violations.push({ file, line, importLine });
    }
  }

  return violations;
}

async function main() {
  console.log('\n🔍 Checking backend boundary compliance...\n');

  const exceptions = loadExceptions();
  let totalViolations = 0;

  // ── Check 1: Firebase Admin imports ──
  console.log('📦 Checking firebase-admin imports...');
  const firebaseAdminFiles = await findFirebaseAdminFiles();
  const faViolations = checkFirebaseAdminImports(firebaseAdminFiles, exceptions);

  if (faViolations.length === 0) {
    console.log('   ✅ All firebase-admin imports are in allowed locations or exceptions\n');
  } else {
    console.log(`   ❌ Found ${faViolations.length} unauthorized firebase-admin import(s):`);
    for (const v of faViolations) {
      console.log(`      ${v.file}:${v.line}  ${v.importLine}`);
    }
    console.log();
    totalViolations += faViolations.length;
  }

  // ── Check 2: Guest Portal API routes ──
  console.log('🗺️  Checking guest portal API routes...');
  const guestRoutes = await findGuestPortalRoutes();
  const gpViolations = checkGuestPortalRoutes(guestRoutes, exceptions);

  if (gpViolations.length === 0) {
    console.log('   ✅ All guest portal API routes are approved\n');
  } else {
    console.log(`   ❌ Found ${gpViolations.length} unapproved guest portal route(s):`);
    for (const v of gpViolations) {
      console.log(`      ${v}`);
    }
    console.log();
    totalViolations += gpViolations.length;
  }

  // ── Check 3: Partner Dashboard new Firebase Admin in routes ──
  console.log('📋 Checking partner dashboard API routes for new Firebase Admin usage...');
  const pdRoutes = await findPartnerDashboardFirebaseRoutes();
  const pdViolations = checkPartnerDashboardRoutes(pdRoutes, exceptions);

  if (pdViolations.length === 0) {
    console.log('   ✅ No unauthorized Firebase Admin usage in partner dashboard routes\n');
  } else {
    console.log(`   ❌ Found ${pdViolations.length} new Firebase Admin import(s) in partner dashboard routes:`);
    for (const v of pdViolations) {
      console.log(`      ${v.file}:${v.line}  ${v.importLine}`);
    }
    console.log();
    totalViolations += pdViolations.length;
  }

  // ── Summary ──
  if (totalViolations === 0) {
    console.log('✅ All backend boundary checks passed!\n');
    process.exit(0);
  } else {
    console.log(`❌ ${totalViolations} backend boundary violation(s) found.\n`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Guardrails check failed:', err);
  process.exit(1);
});
