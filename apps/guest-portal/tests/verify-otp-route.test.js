import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const routePath = new URL('../app/verify-otp/page.jsx', import.meta.url).pathname;

test('verify OTP compatibility route resumes the canonical signup funnel', () => {
  const source = readFileSync(routePath, 'utf8');

  assert.match(source, /const params = await searchParams/);
  assert.match(source, /`\/signup\?next=\$\{encodeURIComponent\(next\)\}`/);
  assert.match(source, /redirect\(signupUrl\)/);
});
