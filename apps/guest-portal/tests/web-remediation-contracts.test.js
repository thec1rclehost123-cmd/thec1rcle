import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (relativePath) => readFileSync(join(root, relativePath), 'utf8');

test('guest layout is protected by a global error boundary', () => {
  const layout = source('app/layout.js');
  const boundary = source('components/GlobalErrorBoundary.jsx');

  assert.match(layout, /<GlobalErrorBoundary>/);
  assert.match(boundary, /getDerivedStateFromError/);
  assert.match(boundary, /componentDidCatch/);
});

test('guest protected routes are rejected at the proxy without a session', () => {
  const proxy = source('proxy.js');

  assert.match(proxy, /request\.cookies\.has\('__session'\)/);
  assert.match(proxy, /pathname\.startsWith\('\/confirmation\/'\)/);
  assert.match(proxy, /pathname\.startsWith\('\/tickets\/pair\/'\)/);
  assert.match(proxy, /NextResponse\.redirect\(loginUrl\)/);
  assert.match(proxy, /'\/confirmation\/:path\*'/);
  assert.match(proxy, /'\/tickets\/pair\/:path\*'/);
});

test('checkout and vanity event effects depend on searchParams', () => {
  const checkout = source('app/checkout/[eventId]/PageClient.jsx');
  const vanityEvent = source('app/[handle]/[eventSlug]/PageClient.jsx');

  assert.match(checkout, /searchKey,\s+searchParams,\s+\]\);/);
  assert.match(vanityEvent, /\[handle, redirectQuery, router, searchParams, slug\]/);
});
