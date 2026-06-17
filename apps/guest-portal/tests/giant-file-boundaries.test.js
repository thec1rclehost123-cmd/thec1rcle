import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const hotPathFiles = [
  'app/app/page.js',
  'app/[handle]/PageClient.jsx',
  'app/event/[eventId]/queue/PageClient.jsx',
  'components/CheckoutContainer.jsx',
  'components/EventDetail.jsx',
  'components/venue/ReservationCalendarModal.jsx',
  'app/login/PageClient.jsx',
  'app/tickets/PageClient.jsx',
  'components/EditProfileModal.jsx',
  'components/ExploreClient.jsx',
  'features/app-download/components/AppMarketingExperience.jsx',
  'features/tickets/ticketPageComponents.jsx',
];

test('guest hot-path orchestration files stay below the 1,000 line ceiling', () => {
  for (const relativePath of hotPathFiles) {
    const source = readFileSync(join(root, relativePath), 'utf8');
    const lineCount = source.split('\n').length;
    assert.ok(
      lineCount < 1000,
      `${relativePath} has ${lineCount} lines and should stay decomposed`,
    );
  }
});

test('checkout inventory refresh is event-driven instead of interval polling', () => {
  const checkout = readFileSync(join(root, 'components/CheckoutContainer.jsx'), 'utf8');
  const inventoryHook = readFileSync(
    join(root, 'features/checkout/hooks/useCheckoutSession.js'),
    'utf8',
  );

  assert.equal(
    checkout.includes('setInterval('),
    false,
    'CheckoutContainer must not own an inventory polling loop',
  );
  assert.equal(
    inventoryHook.includes('setInterval('),
    false,
    'checkout session must not poll inventory on an interval',
  );
  assert.equal(
    inventoryHook.includes('calculateCheckout('),
    true,
    'checkout session should refresh inventory through the quote seam',
  );
  assert.equal(
    inventoryHook.includes('selectedTicketSignature'),
    true,
    'inventory should refresh when ticket selections change',
  );
  assert.equal(
    inventoryHook.includes('cartReservation'),
    true,
    'inventory should refresh when reservation state changes',
  );
});

test('root client providers defer side-effect managers out of the provider module', () => {
  const source = readFileSync(join(root, 'components/providers/AppProviders.jsx'), 'utf8');

  assert.equal(source.includes("import GlobalAuthManager from '../GlobalAuthManager'"), false);
  assert.equal(source.includes("import OfflineListener from '../OfflineListener'"), false);
  assert.equal(source.includes("import CacheWarmer from '../CacheWarmer'"), false);
  assert.equal(source.includes("dynamic(() => import('../GlobalAuthManager')"), true);
  assert.equal(source.includes("dynamic(() => import('../OfflineListener')"), true);
  assert.equal(source.includes("dynamic(() => import('../CacheWarmer')"), true);
});

test('guest API client records duplicate GET diagnostics in development only', () => {
  const source = readFileSync(join(root, 'lib/api/client.js'), 'utf8');

  assert.equal(source.includes('getGuestFetchDiagnostics'), true);
  assert.equal(source.includes('__C1RCLE_GUEST_FETCH_DIAGNOSTICS__'), true);
  assert.equal(source.includes("process.env.NODE_ENV === 'production'"), true);
  assert.equal(source.includes('recordGuestFetch(normalizedPath, method)'), true);
});
