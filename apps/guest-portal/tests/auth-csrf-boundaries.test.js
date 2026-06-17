import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

test('Guest API client automatically forwards CSRF for cookie-backed mutations', () => {
  const source = readFileSync(join(root, 'lib/api/client.js'), 'utf8');

  assert.equal(
    source.includes('guest_csrf'),
    true,
    'client must read the gateway-issued CSRF cookie',
  );
  assert.equal(
    source.includes('x-csrf-token'),
    true,
    'client must send the CSRF header on mutations',
  );
  assert.equal(
    source.includes('localStorage'),
    false,
    'API client must not use localStorage token fallback',
  );
  assert.equal(
    source.includes('Authorization'),
    false,
    'Guest Portal browser client must not invent bearer auth',
  );
});

test('Auth provider exposes cookie-backed auth without token fallback API', () => {
  const source = readFileSync(join(root, 'components/providers/AuthProvider.jsx'), 'utf8');
  const authApi = readFileSync(join(root, 'features/auth/api/authApi.js'), 'utf8');

  assert.equal(
    source.includes('getToken'),
    false,
    'AuthProvider must not expose null token compatibility APIs',
  );
  assert.equal(
    source.includes('loadGuestBootstrap'),
    true,
    'AuthProvider should bootstrap through the auth feature seam',
  );
  assert.equal(
    source.includes('firebase/auth'),
    false,
    'AuthProvider must not import Firebase Auth',
  );
  assert.equal(
    authApi.includes('guestApi.auth.me'),
    true,
    'auth feature API should own the typed guest auth seam',
  );
});

test('Auth provider preserves an active guest session across transient bootstrap failures', () => {
  const source = readFileSync(join(root, 'components/providers/AuthProvider.jsx'), 'utf8');

  assert.equal(
    source.includes('hadAuthenticatedSessionRef'),
    true,
    'AuthProvider should track whether a real guest session was established',
  );
  assert.equal(
    source.includes('if (!hadAuthenticatedSessionRef.current) {'),
    true,
    'bootstrap failures should only clear state when no session was established',
  );
  assert.equal(
    source.includes("console.error('Guest auth bootstrap failed', authError);"),
    true,
    'bootstrap failures should still be surfaced for investigation',
  );
});
