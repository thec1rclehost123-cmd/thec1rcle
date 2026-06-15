import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

test('Ticket and profile client helpers use the generated API seam', () => {
  const ticketApi = readFileSync(join(root, 'features/tickets/ticketApi.js'), 'utf8');
  const profileQueries = readFileSync(join(root, 'features/profiles/profileQueries.js'), 'utf8');
  const profilePage = readFileSync(join(root, 'app/profile/[userId]/PageClient.jsx'), 'utf8');
  const profileApi = readFileSync(join(root, 'features/profile/api/profileApi.js'), 'utf8');
  const avatarCropper = readFileSync(
    join(root, 'features/profile/hooks/useAvatarCropper.js'),
    'utf8',
  );
  const coverWalletApi = readFileSync(join(root, 'features/tickets/api/coverWalletApi.js'), 'utf8');
  const coverCard = readFileSync(join(root, 'components/CoverTicketCard.jsx'), 'utf8');
  const confirmationPage = readFileSync(
    join(root, 'app/confirmation/[orderId]/PageClient.jsx'),
    'utf8',
  );
  const orderApi = readFileSync(join(root, 'features/orders/api/orderApi.js'), 'utf8');
  const venueReservationApi = readFileSync(
    join(root, 'features/venues/api/venueReservationApi.js'),
    'utf8',
  );

  assert.equal(
    ticketApi.includes('guestApi.'),
    true,
    'ticketApi should delegate to the generated API seam',
  );
  assert.equal(
    ticketApi.includes('/api/auth'),
    false,
    'ticketApi must not target legacy /api auth routes',
  );
  assert.equal(
    ticketApi.includes('/api/tickets'),
    false,
    'ticketApi must not target legacy /api ticket routes',
  );
  assert.equal(
    profileQueries.includes('guestApi.profiles.get'),
    true,
    'Profile feature queries should delegate profile reads to the typed guest API seam',
  );
  assert.equal(
    profileQueries.includes('guestApiFetch'),
    false,
    'Profile feature queries should not bypass the typed guest API seam',
  );
  assert.equal(
    profileQueries.includes('placeholderData:'),
    false,
    'Profile query should wait for the real aggregate instead of painting a placeholder owner snapshot',
  );
  assert.equal(
    profileQueries.includes('initialData:'),
    false,
    'Profile query must not freeze empty event arrays as fresh query data',
  );
  assert.equal(
    profileQueries.includes('query: viewerId'),
    false,
    'Profile query must not fan out cache keys with an ignored viewerId query param',
  );
  assert.equal(
    profilePage.includes('useGuestProfileQuery'),
    true,
    'Profile page should compose the feature query hook',
  );
  assert.equal(
    profilePage.includes('guestApiFetch'),
    false,
    'Profile page must not own profile API fetching',
  );
  assert.equal(
    profilePage.includes('/api/profile/'),
    false,
    'Profile page must not call /api/profile',
  );
  assert.equal(
    profileApi.includes('guestApi.profiles.avatar'),
    true,
    'profile avatar uploads should use the typed guest API seam',
  );
  assert.equal(
    avatarCropper.includes('uploadGuestAvatar'),
    true,
    'avatar cropper should delegate uploads to the profile API seam',
  );
  assert.equal(
    coverWalletApi.includes('guestApi.tickets.coverChargeWallet'),
    true,
    'cover wallet feature API should use the generated API seam',
  );
  assert.equal(
    coverCard.includes('fetchCoverChargeWallet'),
    true,
    'cover wallet reads should use the ticket feature API seam',
  );
  assert.equal(
    orderApi.includes('guestApi.orders.get'),
    true,
    'order feature API should use the generated order seam',
  );
  assert.equal(
    confirmationPage.includes('fetchGuestOrder'),
    true,
    'confirmation page should use the order feature API seam',
  );
  assert.equal(
    venueReservationApi.includes('guestApi.venues.reserve'),
    true,
    'venue reservations should use the generated venue seam',
  );
  assert.equal(
    profileApi.includes('gatewayJson('),
    false,
    'profile uploads must not bypass the typed guest API seam',
  );
});

test('ticket wallet list reads stay on a single grouped wallet payload', () => {
  const ticketQueries = readFileSync(join(root, 'features/tickets/ticketsQueries.js'), 'utf8');
  const ticketsPage = readFileSync(join(root, 'app/tickets/PageClient.jsx'), 'utf8');

  assert.equal(
    ticketQueries.includes('guestApi.tickets.coverWallet'),
    false,
    'ticket wallet queries must not fan out into per-order cover wallet requests',
  );
  assert.equal(
    ticketQueries.includes('useCoverWalletsQueries'),
    false,
    'ticket wallet queries must stay on a single wallet query',
  );
  assert.equal(
    ticketQueries.includes('coverWalletsByOrder'),
    true,
    'ticket wallet normalization should preserve grouped cover wallets',
  );
  assert.equal(
    ticketsPage.includes('useCoverWalletsQueries'),
    false,
    'tickets page must not trigger per-order cover wallet queries',
  );
  assert.equal(
    ticketsPage.includes('coverWalletsByOrder'),
    true,
    'tickets page should consume grouped cover wallets from the wallet payload',
  );
});

test('Ticket share and transfer modals keep OTP requests aligned with gateway auth schema', () => {
  const ticketApi = readFileSync(join(root, 'features/tickets/ticketApi.js'), 'utf8');
  const shareModal = readFileSync(join(root, 'features/tickets/ShareModal.jsx'), 'utf8');
  const transferModal = readFileSync(join(root, 'features/tickets/TransferModal.jsx'), 'utf8');

  assert.equal(
    ticketApi.includes('type: "transaction"'),
    false,
    'ticket OTP helpers must not send the removed transaction OTP type',
  );
  assert.equal(
    ticketApi.includes('type: "email", recipient:'),
    true,
    'ticket OTP helpers should send email recipient bodies',
  );
  assert.match(shareModal, /import \{ useEffect, useState \} from "react";/);
  assert.match(transferModal, /import \{ useEffect, useState \} from "react";/);
  assert.equal(shareModal.includes('Share2'), true, 'ShareModal should import the icon it renders');
});

test('Client auth wrapper exposes cookie-backed gateway auth, not Firebase SDK auth', () => {
  const source = readFileSync(join(root, 'components/providers/AuthProvider.jsx'), 'utf8');
  const authApi = readFileSync(join(root, 'features/auth/api/authApi.js'), 'utf8');

  assert.equal(source.includes('loginGuest'), true);
  assert.equal(source.includes('registerGuest'), true);
  assert.equal(source.includes('loadGuestBootstrap'), true);
  assert.equal(source.includes('gatewayJson('), false);
  assert.equal(source.includes('firebase/auth'), false);
  assert.equal(authApi.includes('guestApi.auth.login'), true);
  assert.equal(authApi.includes('guestApi.auth.register'), true);
  assert.equal(authApi.includes('guestApi.auth.me'), true);
});
