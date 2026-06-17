import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const pageClientPath = path.resolve(process.cwd(), 'app/tickets/PageClient.jsx');
const ticketsStorePath = path.resolve(process.cwd(), 'store/ticketsStore.js');
const ticketQueriesPath = path.resolve(process.cwd(), 'features/tickets/ticketsQueries.js');
const guestApiClientPath = path.resolve(process.cwd(), 'lib/api/client.js');
const cacheWarmerPath = path.resolve(process.cwd(), 'components/CacheWarmer.js');

test('tickets page waits for auth bootstrap before loading tickets', () => {
  const source = readFileSync(pageClientPath, 'utf8');

  assert.equal(source.includes('bootstrap?.routeAccess?.isAuthenticated'), true);
  assert.equal(source.includes('canLoadTickets'), true);
  assert.equal(
    source.includes('useTicketsWalletQuery(user?.uid, { enabled: canLoadTickets })'),
    true,
  );
  assert.equal(source.includes('useCoverWalletsQueries'), false);
});

test('tickets server state is React Query owned, with a compatibility-only store shim', () => {
  const source = readFileSync(ticketsStorePath, 'utf8');
  const querySource = readFileSync(ticketQueriesPath, 'utf8');
  const clientSource = readFileSync(guestApiClientPath, 'utf8');

  assert.equal(source.includes('useTicketsWalletQuery'), true);
  assert.equal(source.includes('zustand'), false);
  assert.equal(querySource.includes('guestApi.tickets.wallet'), true);
  assert.equal(querySource.includes('useCoverWalletsQueries'), false);
  assert.equal(querySource.includes('guestApi.tickets.coverWallet'), false);
  assert.equal(querySource.includes('coverWalletsByOrder'), true);
  assert.equal(querySource.includes('invalidateTicketsQueries'), true);
  assert.equal(clientSource.includes("credentials = 'include'"), true);
});

test('cache warmer only preloads tickets after canonical auth bootstrap succeeds', () => {
  const source = readFileSync(cacheWarmerPath, 'utf8');

  assert.equal(source.includes('bootstrap?.routeAccess?.isAuthenticated'), true);
});
