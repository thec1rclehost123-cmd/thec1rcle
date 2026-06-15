import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const guestRoot = process.cwd();
const repoRoot = join(guestRoot, '..', '..');

test('phase 4 removes dead duplicate profile clients from the guest portal tree', () => {
  assert.equal(existsSync(join(guestRoot, 'app/host/[slug]/HostProfileClient.jsx')), false);
  assert.equal(existsSync(join(guestRoot, 'app/venue/[slug]/VenueProfileClient.jsx')), false);
});

test('phase 4 documents the forensic audit as a historical snapshot after cleanup', () => {
  const source = readFileSync(
    join(repoRoot, 'docs/guest-portal-forensic-audit-2026-04-23.md'),
    'utf8',
  );

  assert.equal(source.includes('Post-audit phase 4 update:'), true);
  assert.equal(source.includes('historical audit evidence'), true);
});
