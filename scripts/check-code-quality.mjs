import { readFileSync, statSync, readdirSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const errors = [];
const warnings = [];

function error(msg) {
  errors.push(msg);
}
function warn(msg) {
  warnings.push(msg);
}

function glob(pattern, { cwd, ignore }) {
  const parts = pattern.split('/').filter(Boolean);
  const results = [];
  function walk(dir, idx) {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const e of entries) {
      const full = join(dir, e);
      const rel = relative(cwd, full).replace(/\\/g, '/');
      if (ignore && ignore.some((p) => rel.startsWith(p.replace('**/', '')))) continue;
      try {
        const s = statSync(full);
        if (idx === parts.length - 1) {
          if (
            parts[idx] === '**' ||
            parts[idx] === '*' ||
            e.endsWith(parts[idx].replace('*', '').replace('.*', ''))
          ) {
            if (
              parts[idx] === '**' ||
              parts[idx] === '*' ||
              e.includes(parts[idx].replace('*', '').replace('*', ''))
            ) {
              if (
                !parts[idx].includes('*') ||
                e.match(new RegExp('^' + parts[idx].replace(/\*/g, '.*') + '$'))
              ) {
                results.push(rel);
              }
            }
          }
        }
        if (s.isDirectory()) {
          if (idx < parts.length) {
            if (parts[idx] === '**') {
              walk(full, idx);
              walk(full, idx + 1);
            } else if (parts[idx] === '*' || e === parts[idx]) {
              walk(full, idx + 1);
            }
          }
        }
      } catch {}
    }
  }
  walk(cwd, 0);
  return results;
}

function findFiles(baseDir, pattern) {
  const results = [];
  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const e of entries) {
      if (e === 'node_modules' || e.startsWith('.')) continue;
      const full = join(dir, e);
      try {
        const s = statSync(full);
        if (s.isDirectory()) walk(full);
        else if (s.isFile() && e.endsWith(pattern)) results.push(full);
      } catch {}
    }
  }
  walk(baseDir);
  return results;
}

// ── 1. Debug files in root ──────────────────────────────────────────────
const rootEntries = readdirSync(ROOT).filter((e) => e.startsWith('debug_'));
if (rootEntries.length) {
  error(
    `Found ${rootEntries.length} debug files in root (should not be committed):\n  ${rootEntries.join('\n  ')}`,
  );
}

// ── 2. Backup/duplicate files (pattern: "* 2.*") ───────────────────────
function findBackupFiles(dir) {
  let results = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const e of entries) {
    if (e === 'node_modules' || e.startsWith('.')) continue;
    const full = join(dir, e);
    try {
      const s = statSync(full);
      if (s.isDirectory()) results = results.concat(findBackupFiles(full));
      else if (s.isFile() && /\s2\.[^.]+$/.test(e))
        results.push(relative(ROOT, full).replace(/\\/g, '/'));
    } catch {}
  }
  return results;
}
const backupFiles = findBackupFiles(ROOT);
if (backupFiles.length) {
  error(
    `Found ${backupFiles.length} backup/duplicate files (pattern: "* 2.*"):\n  ${backupFiles.slice(0, 20).join('\n  ')}${backupFiles.length > 20 ? `\n  ... and ${backupFiles.length - 20} more` : ''}`,
  );
}

// ── 3. debugger statements in source files ──────────────────────────────
const sourceExts = ['.js', '.jsx', '.ts', '.tsx'];
const srcDirs = ['apps', 'packages', 'functions', 'scripts'];
for (const dir of srcDirs) {
  const base = join(ROOT, dir);
  if (statSync(base, { throwIfNoEntry: false })?.isDirectory()) {
    for (const ext of sourceExts) {
      const files = findFiles(base, ext);
      for (const f of files) {
        const content = readFileSync(f, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (/^\s*debugger\s*[;]?\s*(\/\/.*)?$/.test(lines[i])) {
            error(`debugger statement in ${relative(ROOT, f).replace(/\\/g, '/')}:${i + 1}`);
          }
        }
      }
    }
  }
}

// ── 4. .only in test files ─────────────────────────────────────────────
for (const dir of srcDirs) {
  const base = join(ROOT, dir);
  if (statSync(base, { throwIfNoEntry: false })?.isDirectory()) {
    const testFiles = findFiles(base, '.test.js')
      .concat(findFiles(base, '.test.ts'))
      .concat(findFiles(base, '.test.tsx'));
    for (const f of testFiles) {
      const content = readFileSync(f, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const ln = lines[i];
        if (
          ln.includes('.only(') ||
          ln.includes('test.only(') ||
          ln.includes('it.only(') ||
          ln.includes('describe.only(')
        ) {
          warn(`.only() in test file ${relative(ROOT, f).replace(/\\/g, '/')}:${i + 1}`);
        }
      }
    }
  }
}

// ── 5. console.* in non-test source files (warn only) ────────────────────
const consoleCounts = {};
for (const dir of srcDirs) {
  const base = join(ROOT, dir);
  if (statSync(base, { throwIfNoEntry: false })?.isDirectory()) {
    for (const ext of sourceExts) {
      const files = findFiles(base, ext);
      for (const f of files) {
        const rel = relative(ROOT, f).replace(/\\/g, '/');
        if (rel.includes('/__tests__/') || rel.includes('/tests/') || rel.includes('.test.'))
          continue;
        try {
          const content = readFileSync(f, 'utf-8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (
              /\bconsole\.(log|warn|error|info|debug)\s*\(/.test(lines[i]) &&
              !lines[i].trim().startsWith('//')
            ) {
              consoleCounts[rel] = (consoleCounts[rel] || 0) + 1;
            }
          }
        } catch {}
      }
    }
  }
}
const sourcesWithLogs = Object.keys(consoleCounts);
if (sourcesWithLogs.length > 0) {
  const total = sourcesWithLogs.reduce((a, k) => a + consoleCounts[k], 0);
  warn(
    `Found ${total} console.* calls across ${sourcesWithLogs.length} non-test source files (first 10):\n  ${sourcesWithLogs
      .slice(0, 10)
      .map((f) => `  ${f} (${consoleCounts[f]})`)
      .join('\n  ')}`,
  );
}

// ── Report ──────────────────────────────────────────────────────────────
console.log('\n═══ Code Quality Check Report ═══\n');

if (errors.length === 0 && warnings.length === 0) {
  console.log('✓ All checks passed. No issues found.');
  process.exit(0);
}

if (errors.length) {
  console.log(`❌ ${errors.length} Error(s) (will fail CI):\n`);
  errors.forEach((e) => console.log(`  • ${e}\n`));
}

if (warnings.length) {
  console.log(`\n⚠️  ${warnings.length} Warning(s) (informational):\n`);
  warnings.forEach((w) => console.log(`  • ${w}\n`));
}

console.log(`\nSummary: ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length > 0 ? 1 : 0);
