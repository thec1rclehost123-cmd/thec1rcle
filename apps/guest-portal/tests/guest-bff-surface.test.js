import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { checkoutReserveBodySchema } from '../lib/bff/contracts.js';
import { getGuestBffFlags } from '../lib/bff/flags.js';
import { normalizeCheckoutEventDetail } from '../features/checkout/checkoutEventModel.js';

const root = process.cwd();

test('Guest Portal BFF route surface is present', () => {
  const requiredRoutes = [
    'app/api/app/home/overview/route.js',
    'app/api/app/tickets/overview/route.js',
    'app/api/app/events/[eventId]/detail/route.js',
    'app/api/app/checkout/summary/route.js',
    'app/api/app/checkout/quote/route.js',
    'app/api/app/checkout/reserve/route.js',
    'app/api/app/checkout/initiate/route.js',
    'app/api/app/checkout/verify/route.js',
    'app/api/app/checkout/recover/route.js',
    'app/api/app/profile/overview/route.js',
    'app/api/app/profile/update/route.js',
    'app/api/app/profiles/[userId]/detail/route.js',
    'app/api/app/notifications/summary/route.js',
    'app/api/app/explore/feed/route.js',
    'app/api/app/orders/[orderId]/confirmation/route.js',
  ];

  for (const relativePath of requiredRoutes) {
    assert.equal(existsSync(join(root, relativePath)), true, `${relativePath} should exist`);
  }
});

test('Guest Portal BFF routes validate their response DTOs before replying', () => {
  const routeFiles = [
    'app/api/app/home/overview/route.js',
    'app/api/app/tickets/overview/route.js',
    'app/api/app/events/[eventId]/detail/route.js',
    'app/api/app/checkout/summary/route.js',
    'app/api/app/checkout/quote/route.js',
    'app/api/app/checkout/reserve/route.js',
    'app/api/app/checkout/initiate/route.js',
    'app/api/app/checkout/verify/route.js',
    'app/api/app/checkout/recover/route.js',
    'app/api/app/profile/overview/route.js',
    'app/api/app/profile/update/route.js',
    'app/api/app/profiles/[userId]/detail/route.js',
    'app/api/app/notifications/summary/route.js',
    'app/api/app/explore/feed/route.js',
    'app/api/app/orders/[orderId]/confirmation/route.js',
  ];

  for (const relativePath of routeFiles) {
    const source = readFileSync(join(root, relativePath), 'utf8');
    assert.equal(
      source.includes('dataSchema:'),
      true,
      `${relativePath} should pass a response dataSchema`,
    );
    assert.equal(
      source.includes('guestBffJsonResponse'),
      true,
      `${relativePath} should reply through the shared BFF envelope helper`,
    );
  }
});

test('Guest Portal BFF flags expose global and per-surface rollout controls', () => {
  const flags = getGuestBffFlags({
    NEXT_PUBLIC_GUEST_BFF_ENABLE_HOME: 'true',
    NEXT_PUBLIC_GUEST_BFF_ENABLE_CHECKOUT: 'true',
    NEXT_PUBLIC_GUEST_BFF_ENABLE_CONFIRMATION: 'true',
    NEXT_PUBLIC_GUEST_BFF_ENABLE_NOTIFICATIONS: '1',
    GUEST_BFF_PARITY_LOGGING: 'yes',
  });

  assert.equal(flags.enableAll, false);
  assert.equal(flags.home, true);
  assert.equal(flags.checkout, true);
  assert.equal(flags.confirmation, true);
  assert.equal(flags.notifications, true);
  assert.equal(flags.tickets, false);
  assert.equal(flags.parity, true);

  const enabledAll = getGuestBffFlags({ NEXT_PUBLIC_GUEST_BFF_ENABLE_ALL: 'true' });
  assert.equal(enabledAll.home, true);
  assert.equal(enabledAll.tickets, true);
  assert.equal(enabledAll.eventDetail, true);
  assert.equal(enabledAll.checkout, true);
  assert.equal(enabledAll.confirmation, true);
  assert.equal(enabledAll.profile, true);
  assert.equal(enabledAll.notifications, true);
  assert.equal(enabledAll.explore, true);
});

test('Guest Portal migrated surfaces are wired to BFF helpers behind flags', () => {
  const expectedReferences = [
    ['app/page.js', 'buildHomeOverviewView'],
    ['app/checkout/[eventId]/page.jsx', 'buildCheckoutSummaryView'],
    ['app/checkout/[eventId]/PageClient.jsx', 'fetchGuestBffCheckoutSummary'],
    ['features/checkout/api/checkoutApi.js', '/checkout/quote'],
    ['app/event/[eventId]/page.jsx', 'buildEventDetailView'],
    ['app/event/[eventId]/PageClient.jsx', 'fetchGuestBffEventDetail'],
    ['app/confirmation/[orderId]/page.jsx', 'buildOrderConfirmationView'],
    ['app/confirmation/[orderId]/PageClient.jsx', 'fetchGuestBffConfirmation'],
    ['app/explore/page.js', 'buildExploreFeedView'],
    ['features/tickets/ticketsQueries.js', 'fetchGuestBffTicketsOverview'],
    ['features/profiles/profileQueries.js', 'fetchGuestBffProfileDetail'],
    ['features/auth/api/authApi.js', '/profile/update'],
    ['features/notifications/notificationsQueries.js', 'fetchGuestBffNotificationsSummary'],
    ['store/exploreStore.js', 'fetchGuestBffExploreFeed'],
  ];

  for (const [relativePath, token] of expectedReferences) {
    const source = readFileSync(join(root, relativePath), 'utf8');
    assert.equal(source.includes(token), true, `${relativePath} should reference ${token}`);
    assert.equal(
      source.includes('isGuestBffEnabled'),
      true,
      `${relativePath} should stay flag-gated`,
    );
  }
});

test('Shared checkout event normalization keeps ticket catalog tiers available to migrated pages', () => {
  const normalized = normalizeCheckoutEventDetail({
    event: {
      id: 'evt_123',
      title: 'Test Event',
      ticketCatalog: {
        tiers: [{ id: 'tier_1', name: 'General', price: 500 }],
      },
    },
  });

  assert.equal(normalized?.id, 'evt_123');
  assert.deepEqual(normalized?.tickets, [{ id: 'tier_1', name: 'General', price: 500 }]);
});

test('Guest Portal checkout reserve contract and payload builder preserve waiting-room admission tokens', () => {
  const checkoutSessionModel = readFileSync(
    join(root, 'features/checkout/utils/checkoutSessionModel.js'),
    'utf8',
  );

  assert.equal(
    checkoutSessionModel.includes('admissionToken: admissionToken || undefined'),
    true,
    'checkout reserve payload builder should forward the waiting-room admission token',
  );

  const parsed = checkoutReserveBodySchema.safeParse({
    admissionToken: 'evt_123:user_1:queue_987:signed',
    deviceId: 'browser-user_1',
    eventId: 'evt_123',
    items: [{ tierId: 'tier_1', quantity: 2 }],
  });
  assert.equal(parsed.success, true);
});
