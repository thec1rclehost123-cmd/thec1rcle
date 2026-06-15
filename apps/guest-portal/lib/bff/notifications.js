import { normalizeBootstrapPayload } from '../../features/auth/utils/authSessionModel.js';
import {
  buildGuestBffError,
  buildGuestBffResult,
  buildGuestBffUpstreamTrace,
  getGuestBffUpstreamError,
  guestBffUpstreamJson,
} from './server.js';

export async function buildNotificationsSummaryView({
  countOnly = false,
  limit = 50,
  unreadOnly = false,
} = {}) {
  const authResult = await guestBffUpstreamJson('/auth/me');
  const auth = authResult.response.ok
    ? normalizeBootstrapPayload(authResult.data)
    : { user: null, profile: null, unreadNotificationCount: 0 };

  if (!auth?.user?.uid) {
    return buildGuestBffResult({
      status: 401,
      data: {
        viewer: null,
        unreadCount: 0,
        items: [],
        pagination: {
          countOnly,
          limit,
          unreadOnly,
          count: 0,
        },
      },
      error: buildGuestBffError('Authentication required.', {
        code: 'UNAUTHORIZED',
        requestId: authResult.requestId,
        status: 401,
      }),
      meta: {
        countOnly,
        requestId: authResult.requestId,
        unreadOnly,
        upstreamCalls: buildGuestBffUpstreamTrace(authResult),
      },
    });
  }

  const listParams = new URLSearchParams();
  const countParams = new URLSearchParams({ countOnly: 'true' });
  if (unreadOnly) listParams.set('unreadOnly', 'true');
  if (limit) listParams.set('limit', String(limit));

  const [notificationsResult, unreadCountResult] = await Promise.all([
    countOnly
      ? Promise.resolve(null)
      : guestBffUpstreamJson(
          `/guest-notifications${listParams.toString() ? `?${listParams.toString()}` : ''}`,
        ),
    guestBffUpstreamJson(`/guest-notifications?${countParams.toString()}`),
  ]);

  if (!unreadCountResult.response.ok || (!countOnly && !notificationsResult?.response?.ok)) {
    const failingResult = !unreadCountResult.response.ok ? unreadCountResult : notificationsResult;
    return buildGuestBffResult({
      status: failingResult?.response?.status || 502,
      data: {
        viewer: auth.user,
        unreadCount: unreadCountResult.response.ok ? unreadCountResult.data?.unreadCount || 0 : 0,
        items: [],
        pagination: {
          countOnly,
          limit,
          unreadOnly,
          count: 0,
        },
      },
      error: buildGuestBffError(
        getGuestBffUpstreamError(failingResult?.data, 'Failed to load notifications.'),
        {
          requestId: failingResult?.requestId || authResult.requestId,
          status: failingResult?.response?.status || 502,
        },
      ),
      meta: {
        countOnly,
        requestId: authResult.requestId,
        unreadOnly,
        upstreamCalls: buildGuestBffUpstreamTrace(
          authResult,
          notificationsResult,
          unreadCountResult,
        ),
      },
    });
  }

  const items = countOnly ? [] : notificationsResult?.data?.notifications || [];

  return buildGuestBffResult({
    status: 200,
    data: {
      viewer: auth.user,
      unreadCount: unreadCountResult.data?.unreadCount || 0,
      items,
      pagination: {
        countOnly,
        limit,
        unreadOnly,
        count: items.length,
      },
    },
    meta: {
      countOnly,
      requestId: authResult.requestId,
      unreadOnly,
      upstreamCalls: buildGuestBffUpstreamTrace(authResult, notificationsResult, unreadCountResult),
    },
  });
}
