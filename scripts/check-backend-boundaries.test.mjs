import { describe, it } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const EXCEPTIONS_FILE = `${ROOT}/governance/backend-boundary-exceptions.json`;
const CHECK_SCRIPT = `${ROOT}/scripts/check-backend-boundaries.mjs`;

describe('Backend Boundary Guardrails', () => {

  it('should have governance/backend-boundary-exceptions.json', () => {
    assert.ok(existsSync(EXCEPTIONS_FILE), 'Missing exceptions file');
    const data = JSON.parse(readFileSync(EXCEPTIONS_FILE, 'utf8'));
    assert.ok(data.firebase_admin_imports, 'Missing firebase_admin_imports section');
    assert.ok(data.guest_portal_api_routes, 'Missing guest_portal_api_routes section');
    assert.ok(data.partner_dashboard_firebase_admin_routes, 'Missing partner_dashboard_firebase_admin_routes section');
  });

  it('should pass the check script with exit code 0', () => {
    try {
      const output = execSync(`node "${CHECK_SCRIPT}"`, {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 120000,
      });
      assert.ok(output.includes('All backend boundary checks passed'), `Unexpected output:\n${output}`);
    } catch (err) {
      assert.fail(`Check script failed:\n${err.stdout || err.message}`);
    }
  });

  it('should have valid JSON in exceptions file', () => {
    assert.doesNotThrow(() => {
      JSON.parse(readFileSync(EXCEPTIONS_FILE, 'utf8'));
    }, 'Invalid JSON in governance/backend-boundary-exceptions.json');
  });

  it('should not have duplicate entries in exceptions lists', () => {
    const data = JSON.parse(readFileSync(EXCEPTIONS_FILE, 'utf8'));
    const exceptions = Object.keys(data.firebase_admin_imports.exceptions);
    const unique = new Set(exceptions);
    assert.strictEqual(unique.size, exceptions.length, 'Duplicate entries found in firebase_admin_imports.exceptions');
  });

});
