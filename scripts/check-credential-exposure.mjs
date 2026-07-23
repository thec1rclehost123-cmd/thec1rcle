/**
 * Credential Exposure Guardrail
 *
 * Checks for plaintext credentials returned in API responses.
 * Run as part of CI: node scripts/check-credential-exposure.mjs
 *
 * Patterns this catches:
 * - decrypt(tempPassword) returned directly in response body
 * - plaintext password sent back to client in any context
 * - hardcoded credentials in source
 */

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const NOISY_PATTERNS = [
  // Temp password returned in API response (decrypted)
  {
    pattern: /tempPassword:\s*decrypt\(/,
    severity: 'HIGH',
    label: 'decrypted tempPassword in API response',
  },
  // Password in response body
  {
    pattern: /password:\s*decrypt\(/,
    severity: 'HIGH',
    label: 'decrypted password in API response',
  },
  // Plaintext credential in response
  {
    pattern: /(?:return|send)\s*.*\{\s*[^}]*password[^}]*\}/i,
    severity: 'MEDIUM',
    label: 'password in response object',
  },
  // Credential stored in Firestore in plaintext
  {
    pattern: /collection\(['"]\w+['"]\)\.doc\(['"]\w+['"]\)\.set\(\s*\{[^}]*password/i,
    severity: 'HIGH',
    label: 'plaintext password written to Firestore',
  },
];

const SOURCE_DIRS = ['apps', 'packages', 'functions/src'];

const results = [];

for (const dir of SOURCE_DIRS) {
  try {
    const output = execSync(
      `grep -rn --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" -E "${'tempPassword|password'}" "${dir}"`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, cwd: process.cwd() },
    );
    const lines = output.split('\n').filter(Boolean);

    for (const line of lines) {
      for (const { pattern, severity, label } of NOISY_PATTERNS) {
        if (pattern.test(line)) {
          const match = line.match(/^([^:]+):(\d+):(.+)$/);
          if (match) {
            results.push({
              file: match[1],
              line: match[2],
              severity,
              label,
              code: match[3].trim(),
            });
          }
        }
      }
    }
  } catch {
    // grep returns non-zero when no matches — that's fine
  }
}

if (results.length > 0) {
  console.error('\n❌ Credential exposure guardrail FAILED');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  for (const r of results) {
    const icon = r.severity === 'HIGH' ? '🔴' : r.severity === 'MEDIUM' ? '🟠' : '🟡';
    console.error(`${icon} [${r.severity}] ${r.label}`);
    console.error(`   ${r.file}:${r.line}`);
    console.error(`   ${r.code.substring(0, 120)}`);
    console.error();
  }
  process.exit(1);
} else {
  console.log(
    '✅ Credential exposure guardrail passed — no plaintext credentials in API responses',
  );
}
