import { describe, it } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

describe('Backend Boundary Guardrails', () => {
  it('should pass with zero violations', () => {
    const output = execSync(`node "${ROOT}/scripts/check-backend-boundaries.mjs"`, {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 120000,
    });
    assert.ok(
      output.includes('All backend boundary checks passed'),
      `Expected success message in:\n${output}`,
    );
  });

  it('should flag guest-portal lib/server files if they violate', () => {
    try {
      execSync(`node "${ROOT}/scripts/check-backend-boundaries.mjs"`, {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 120000,
      });
    } catch (err) {
      const output = err.stdout || err.message;
      assert.ok(
        output.includes('apps/guest-portal/lib/server'),
        `Expected guest-portal violations in:\n${output}`,
      );
    }
  });

  it('should flag partner-dashboard Firebase Admin files if they violate', () => {
    try {
      execSync(`node "${ROOT}/scripts/check-backend-boundaries.mjs"`, {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 120000,
      });
    } catch (err) {
      const output = err.stdout || err.message;
      assert.ok(
        output.includes('apps/partner-dashboard/lib/server'),
        `Expected partner-dashboard violations in:\n${output}`,
      );
    }
  });
});
