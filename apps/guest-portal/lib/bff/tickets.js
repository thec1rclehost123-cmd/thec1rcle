import { normalizeBootstrapPayload } from '../../features/auth/utils/authSessionModel.js';
import {
  EMPTY_TICKETS,
  getTicketsWalletOrderIds,
  normalizeTicketsWallet,
} from '../../features/tickets/ticketsModel.js';
import {
  buildGuestBffError,
  buildGuestBffResult,
  buildGuestBffUpstreamTrace,
  getGuestBffUpstreamError,
  guestBffUpstreamJson,
} from './server.js';

function extractCoverWallets(payload) {
  if (Array.isArray(payload?.wallets)) return payload.wallets;
  if (Array.isArray(payload?.coverWallets)) return payload.coverWallets;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

async function backfillMissingCoverWallets(wallet) {
  const nextByOrder = { ...(wallet?.coverWalletsByOrder || {}) };
  const orderIds = getTicketsWalletOrderIds(wallet).filter(
    (orderId) => nextByOrder[orderId] === undefined,
  );

  if (!orderIds.length) {
    return { coverWalletsByOrder: nextByOrder, upstreamCall: null };
  }

  const batchResult = await guestBffUpstreamJson('/tickets/cover-wallets', {
    body: { orderIds },
    method: 'POST',
  });
  if (batchResult.response.ok) {
    const upstreamMap = batchResult.data?.walletsByOrder || {};
    for (const [orderId, wallets] of Object.entries(upstreamMap)) {
      nextByOrder[orderId] = extractCoverWallets({ wallets });
    }
  }

  return {
    coverWalletsByOrder: nextByOrder,
    upstreamCall: batchResult,
  };
}

function deriveWalletActions(wallet = EMPTY_TICKETS) {
  const totalTickets = [
    ...(wallet.upcomingTickets || []),
    ...(wallet.pastTickets || []),
    ...(wallet.actionNeeded || []),
  ].length;

  return {
    canCancel: totalTickets > 0,
    canReissue: totalTickets > 0,
    canShare: totalTickets > 0,
    canTransfer: totalTickets > 0,
  };
}

export async function buildTicketsOverviewView() {
  const [authResult, ticketsResult] = await Promise.all([
    guestBffUpstreamJson('/auth/me'),
    guestBffUpstreamJson('/tickets'),
  ]);

  const auth = authResult.response.ok
    ? normalizeBootstrapPayload(authResult.data)
    : { user: null, profile: null, unreadNotificationCount: 0 };

  if (!auth?.user?.uid) {
    return buildGuestBffResult({
      status: 401,
      data: {
        viewer: null,
        profile: null,
        unreadCount: 0,
        wallet: EMPTY_TICKETS,
        actions: {},
      },
      error: buildGuestBffError('Authentication required.', {
        code: 'UNAUTHORIZED',
        requestId: authResult.requestId,
        status: 401,
      }),
      meta: {
        requestId: authResult.requestId,
        upstreamCalls: buildGuestBffUpstreamTrace(authResult, ticketsResult),
      },
    });
  }

  if (!ticketsResult.response.ok) {
    return buildGuestBffResult({
      status: ticketsResult.response.status || 502,
      data: {
        viewer: auth.user,
        profile: auth.profile,
        unreadCount: auth.unreadNotificationCount,
        wallet: EMPTY_TICKETS,
        actions: deriveWalletActions(EMPTY_TICKETS),
      },
      error: buildGuestBffError(
        getGuestBffUpstreamError(ticketsResult.data, 'Failed to load tickets.'),
        {
          requestId: ticketsResult.requestId,
          status: ticketsResult.response.status || 502,
        },
      ),
      meta: {
        requestId: authResult.requestId,
        upstreamCalls: buildGuestBffUpstreamTrace(authResult, ticketsResult),
      },
    });
  }

  const wallet = normalizeTicketsWallet(ticketsResult.data);
  const { coverWalletsByOrder, upstreamCall } = await backfillMissingCoverWallets(wallet);
  const nextWallet = {
    ...wallet,
    coverWalletsByOrder,
  };

  return buildGuestBffResult({
    status: 200,
    data: {
      viewer: auth.user,
      profile: auth.profile,
      unreadCount: auth.unreadNotificationCount,
      wallet: nextWallet,
      actions: deriveWalletActions(nextWallet),
    },
    meta: {
      requestId: authResult.requestId,
      upstreamCalls: buildGuestBffUpstreamTrace(authResult, ticketsResult, upstreamCall),
    },
  });
}
