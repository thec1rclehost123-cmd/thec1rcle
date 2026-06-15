import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

test('discovery consumers route browser calls through feature discovery helpers', () => {
  const exploreStore = read('store/exploreStore.js');
  const hostsStore = read('store/hostsStore.js');
  const instantSearch = read('lib/hooks/useInstantSearch.js');

  assert.equal(exploreStore.includes('fetchPublicEvents'), true);
  assert.equal(exploreStore.includes('guestApi.public.events'), false);

  assert.equal(hostsStore.includes('fetchPublicHosts'), true);
  assert.equal(hostsStore.includes('fetchPublicVenues'), true);
  assert.equal(hostsStore.includes('guestApi.public.hosts'), false);
  assert.equal(hostsStore.includes('guestApi.public.venues'), false);

  assert.equal(instantSearch.includes('searchPublicDiscovery'), true);
  assert.equal(instantSearch.includes('fetchSearchSuggestions'), true);
  assert.equal(instantSearch.includes('guestApi.public.search'), false);
});

test('hot-path guest components use feature-owned client API seams', () => {
  const eventRsvp = read('components/EventRSVP.jsx');
  const hostFollow = read('components/profile/HostFollowCta.jsx');
  const venuePage = read('components/venue/VenuePageClient.jsx');
  const authManager = read('components/GlobalAuthManager.jsx');
  const cancelOrder = read('components/CancelOrderModal.jsx');
  const coverWallet = read('components/CoverTicketCard.jsx');
  const confirmationPage = read('app/confirmation/[orderId]/PageClient.jsx');

  assert.equal(eventRsvp.includes('recordPromoterLinkClick'), true);
  assert.equal(eventRsvp.includes('recordEventView'), true);
  assert.equal(eventRsvp.includes('getEventQueueStatus'), true);
  assert.equal(eventRsvp.includes('guestApi.'), false);

  assert.equal(hostFollow.includes('getHostFollowStatus'), true);
  assert.equal(hostFollow.includes('followHost'), true);
  assert.equal(hostFollow.includes('unfollowHost'), true);
  assert.equal(hostFollow.includes('guestApi.'), false);

  assert.equal(venuePage.includes('getVenueFollowStatus'), true);
  assert.equal(venuePage.includes('followVenue'), true);
  assert.equal(venuePage.includes('unfollowVenue'), true);
  assert.equal(venuePage.includes('guestApi.'), false);

  assert.equal(authManager.includes('setEventRsvp'), true);
  assert.equal(authManager.includes('followHost'), true);
  assert.equal(authManager.includes('followVenue'), true);
  assert.equal(authManager.includes('guestApi.'), false);

  assert.equal(cancelOrder.includes('getOrderCancelEligibility'), true);
  assert.equal(cancelOrder.includes('cancelGuestOrder'), true);
  assert.equal(cancelOrder.includes('guestApi.'), false);

  assert.equal(coverWallet.includes('fetchCoverChargeWallet'), true);
  assert.equal(coverWallet.includes('guestApi.'), false);

  assert.equal(confirmationPage.includes('fetchGuestBffConfirmation'), true);
  assert.equal(confirmationPage.includes('fetchGuestOrder'), true);
  assert.equal(confirmationPage.includes('guestApi.orders.get'), false);
});
