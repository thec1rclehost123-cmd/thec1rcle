import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

const retiredBffPaths = [
  'lib/bff',
  'app/api/app/checkout',
  'app/api/app/events',
  'app/api/app/explore',
  'app/api/app/home',
  'app/api/app/notifications',
  'app/api/app/orders',
  'app/api/app/profile',
  'app/api/app/profiles',
  'app/api/app/tickets',
];

test('Guest Portal ships one canonical Fastify data-access path', () => {
  for (const relativePath of retiredBffPaths) {
    assert.equal(existsSync(join(root, relativePath)), false, `${relativePath} must stay removed`);
  }

  const client = read('lib/api/client.js');
  const server = read('lib/api/server.js');
  const nextConfig = read('next.config.mjs');

  assert.equal(client.includes("from './generated/guest-v1.js'"), true);
  assert.equal(client.includes("const GUEST_BFF_BASE_PATH = '/api/app'"), false);
  assert.equal(server.includes('resolveGuestApiBaseUrl'), true);
  assert.equal(nextConfig.includes("source: '/api/v1/:path*'"), true);
});

test('hot Guest Portal flows call typed gateway adapters without rollout branches', () => {
  const surfaces = [
    ['features/checkout/api/checkoutApi.js', 'guestApi.checkout.initiate'],
    ['features/tickets/ticketsQueries.js', 'guestApi.tickets.wallet'],
    ['features/notifications/notificationsQueries.js', 'guestApi.notifications.list'],
    ['features/profiles/profileQueries.js', 'guestApi.profiles.get'],
    ['features/auth/api/authApi.js', 'guestApi.profiles.update'],
    ['store/exploreStore.js', 'fetchPublicEvents'],
  ];

  for (const [relativePath, canonicalCall] of surfaces) {
    const source = read(relativePath);
    assert.equal(source.includes(canonicalCall), true, `${relativePath} must use ${canonicalCall}`);
    assert.equal(source.includes('guestBff'), false, `${relativePath} must not import BFF helpers`);
    assert.equal(
      source.includes('isGuestBffEnabled'),
      false,
      `${relativePath} must not retain BFF rollout branches`,
    );
  }
});

test('generic guest profile updates are part of the generated contract', () => {
  const openApi = read('../api-gateway/src/openapi/guest-v1.ts');
  const generated = read('lib/api/generated/guest-v1.js');
  const client = read('lib/api/client.js');

  assert.equal(openApi.includes("'/profiles':"), true);
  assert.equal(openApi.includes("operationId: 'updateGuestProfile'"), true);
  assert.equal(
    generated.includes("updateGuestProfile: { method: 'PATCH', path: '/profiles' }"),
    true,
  );
  assert.equal(client.includes("guestApiOperationJson('updateGuestProfile'"), true);
});

test('local route handlers are value-adding and never gateway forwarders', () => {
  const emailPreview = read('app/api/dev/email-preview/route.js');
  const revalidate = read('app/api/internal/revalidate/route.ts');

  assert.equal(emailPreview.includes("await import('react-dom/server')"), true);
  assert.equal(emailPreview.includes('GATEWAY_URL'), false);
  assert.equal(revalidate.includes('revalidateTag'), true);
});
