import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const routePath = fileURLToPath(new URL('../app/verify-otp/page.jsx', import.meta.url));

test('verify OTP compatibility route resumes the canonical signup funnel', () => {
  const source = readFileSync(routePath, 'utf8');

  assert.match(source, /const params = await searchParams/);
  assert.match(source, /`\/signup\?next=\$\{encodeURIComponent\(next\)\}`/);
  assert.match(source, /redirect\(signupUrl\)/);
});
