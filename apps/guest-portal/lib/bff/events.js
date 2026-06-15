import { normalizeBootstrapPayload } from '../../features/auth/utils/authSessionModel.js';
import {
  GUEST_BFF_CACHE,
  buildGuestBffError,
  buildGuestBffResult,
  buildGuestBffUpstreamTrace,
  guestBffUpstreamJson,
  getGuestBffUpstreamError,
} from './server.js';

function toPartnerSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeEventTickets(event) {
  if (!event) return null;
  return {
    ...event,
    tickets: event.ticketCatalog?.tiers ?? event.tickets ?? [],
  };
}

function resolveHostProfile(event) {
  let hostProfile = null;

  if (event?.hostData && Object.keys(event.hostData).length > 0) {
    hostProfile = { ...event.hostData, type: event.hostData.type || 'host' };
  }

  if (!hostProfile && event?.venueData && Object.keys(event.venueData).length > 0) {
    hostProfile = {
      ...event.venueData,
      type: 'venue',
      avatar: event.venueData.photoURL || event.venueData.image,
    };
  }

  if (hostProfile && !hostProfile.type) hostProfile.type = 'host';
  if (hostProfile && !hostProfile.slug) {
    hostProfile.slug = hostProfile.handle ? toPartnerSlug(hostProfile.handle) : hostProfile.id;
  }

  return hostProfile;
}

function buildCommerceSummary(event) {
  const tickets = event?.tickets || [];
  const prices = tickets
    .map((ticket) => Number(ticket?.price || 0))
    .filter((value) => Number.isFinite(value));

  return {
    tickets,
    startingPrice: prices.length > 0 ? Math.min(...prices) : 0,
    isFreeEntry: tickets.length > 0 && prices.every((value) => value === 0),
  };
}

function buildViewerSummary(auth, eventId, viewerState = null) {
  const attendedEvents = auth?.profile?.attendedEvents || [];

  return {
    ...(auth?.user || {}),
    isAuthenticated: Boolean(auth?.user?.uid),
    hasRsvped: Boolean(
      viewerState?.hasRsvped !== undefined
        ? viewerState.hasRsvped
        : eventId && attendedEvents.includes(eventId),
    ),
    queue: viewerState?.queue || null,
    unreadCount: auth?.unreadNotificationCount || 0,
  };
}

export async function buildEventDetailView(eventId) {
  const [detailResult, authResult] = await Promise.all([
    guestBffUpstreamJson(`/public/events/${encodeURIComponent(eventId)}`, {
      cacheMode: GUEST_BFF_CACHE.PUBLIC_REVALIDATED,
      forwardCookies: false,
      next: { revalidate: 30 },
    }),
    guestBffUpstreamJson('/auth/me'),
  ]);

  const auth = authResult.response.ok
    ? normalizeBootstrapPayload(authResult.data)
    : { user: null, profile: null, unreadNotificationCount: 0 };

  if (!detailResult.response.ok) {
    return buildGuestBffResult({
      status: detailResult.response.status || 404,
      data: {
        event: null,
        host: null,
        viewer: buildViewerSummary(auth, eventId),
        commerce: null,
        queue: null,
        interestedData: { count: 0, users: [] },
      },
      error: buildGuestBffError(
        getGuestBffUpstreamError(detailResult.data, 'Unable to load event.'),
        {
          requestId: detailResult.requestId,
          status: detailResult.response.status || 404,
        },
      ),
      meta: {
        requestId: detailResult.requestId,
        upstreamCalls: buildGuestBffUpstreamTrace(detailResult, authResult),
      },
    });
  }

  const detail = detailResult.data?.event ? detailResult.data : { event: detailResult.data };
  const event = normalizeEventTickets(detail?.event || detailResult.data);

  const viewerStateResult =
    event?.id && auth?.user?.uid
      ? await guestBffUpstreamJson(`/events/${encodeURIComponent(event.id)}/viewer-state`)
      : null;
  const queue = viewerStateResult?.response?.ok ? viewerStateResult.data?.queue || null : null;
  const viewerState = viewerStateResult?.response?.ok ? viewerStateResult.data : null;

  return buildGuestBffResult({
    status: 200,
    data: {
      event: {
        ...event,
        viewerState,
      },
      host: resolveHostProfile(event),
      viewer: buildViewerSummary(auth, event?.id || eventId, viewerState),
      commerce: buildCommerceSummary(event),
      queue,
      interestedData: detail?.interestedData || { count: 0, users: [] },
    },
    meta: {
      requestId: detailResult.requestId,
      upstreamCalls: buildGuestBffUpstreamTrace(detailResult, authResult, viewerStateResult),
    },
  });
}
