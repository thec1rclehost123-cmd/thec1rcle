import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

test('Root providers do not prewarm page-owned server state', () => {
  const source = readFileSync(join(root, 'components/providers/AppProviders.jsx'), 'utf8');

  assert.equal(source.includes('CacheWarmer'), false);
  assert.equal(source.includes('fetchTicketsWallet'), false);
  assert.equal(source.includes('fetchEvents'), false);
  assert.equal(source.includes('fetchHosts'), false);
});

test('Ticket wallet server state has a feature-owned React Query seam', () => {
  const source = readFileSync(join(root, 'features/tickets/ticketsQueries.js'), 'utf8');
  const pageSource = readFileSync(join(root, 'app/tickets/PageClient.jsx'), 'utf8');
  const storeSource = readFileSync(join(root, 'store/ticketsStore.js'), 'utf8');

  assert.equal(
    source.includes('@tanstack/react-query'),
    true,
    'ticket wallet reads must expose a React Query hook',
  );
  assert.equal(
    source.includes('guestApi.tickets.wallet'),
    true,
    'ticket wallet reads must use the typed guest API seam',
  );
  assert.equal(
    source.includes('normalizeTicketsWallet'),
    true,
    'ticket wallet response shaping must be feature-owned',
  );
  assert.equal(
    source.includes('invalidateTicketsQueries'),
    true,
    'ticket mutations must invalidate the ticket query family',
  );
  assert.equal(
    pageSource.includes('useTicketsWalletQuery'),
    true,
    'tickets page must read wallet state through React Query',
  );
  assert.equal(
    pageSource.includes('useTicketsStore'),
    false,
    'tickets page must not read wallet server state from Zustand',
  );
  assert.equal(
    storeSource.includes('zustand'),
    false,
    'ticket store shim must not own server-state caching',
  );
});

test('Guest notifications have a feature-owned React Query seam', () => {
  const source = readFileSync(join(root, 'features/notifications/notificationsQueries.js'), 'utf8');
  const authSource = readFileSync(join(root, 'components/providers/AuthProvider.jsx'), 'utf8');

  assert.equal(
    source.includes('@tanstack/react-query'),
    true,
    'guest notifications must expose React Query hooks',
  );
  assert.equal(
    source.includes('guestApi.notifications'),
    true,
    'notification reads and writes must use the typed guest API seam',
  );
  assert.equal(
    source.includes('invalidateGuestNotifications'),
    true,
    'notification mutations must invalidate notification queries',
  );
  assert.equal(
    authSource.includes('useGuestUnreadNotificationCountQuery'),
    true,
    'auth shell count must come from the notification query seam',
  );
});

test('Hosts directory default tabs render tab-scoped server data before store data', () => {
  const source = readFileSync(join(root, 'app/hosts/HostsClient.jsx'), 'utf8');

  assert.equal(
    source.includes(
      'const usingInitialResults = hasDefaultFilters && activeInitialResults.length > 0',
    ),
    true,
    'default Venues/Hosts tabs must prefer active tab initial data over persisted store results',
  );
  assert.equal(
    source.includes('const results = usingInitialResults ? activeInitialResults : storeResults'),
    true,
    'filtered directory views should still read fetched store results',
  );
});
