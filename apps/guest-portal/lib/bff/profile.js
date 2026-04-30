import { normalizeBootstrapPayload } from "../../features/auth/utils/authSessionModel.js";
import {
  buildGuestBffError,
  buildGuestBffResult,
  buildGuestBffUpstreamTrace,
  getGuestBffUpstreamError,
  guestBffUpstreamJson,
} from "./server.js";

function buildProfileBadges(profile) {
  const badges = ["Member"];
  if (profile?.hostStatus === "approved") badges.push("Host");
  if (profile?.hostStatus === "pending") badges.push("Host Pending");
  if (profile?.isPro || profile?.proPass === true) badges.push("Pro Pass");
  if (profile?.roles?.includes?.("admin")) badges.push("Admin");
  return badges;
}

export async function buildProfileOverviewView() {
  const authResult = await guestBffUpstreamJson("/auth/me");
  const auth = authResult.response.ok
    ? normalizeBootstrapPayload(authResult.data)
    : { user: null, profile: null, unreadNotificationCount: 0 };

  if (!auth?.user?.uid) {
    return buildGuestBffResult({
      status: 401,
      data: {
        viewer: null,
        unreadCount: 0,
        profile: null,
        events: { upcoming: [], attended: [] },
        badges: [],
      },
      error: buildGuestBffError("Authentication required.", {
        code: "UNAUTHORIZED",
        requestId: authResult.requestId,
        status: 401,
      }),
      meta: {
        requestId: authResult.requestId,
        upstreamCalls: buildGuestBffUpstreamTrace(authResult),
      },
    });
  }

  const profileResult = await guestBffUpstreamJson(
    `/guest-profiles/${encodeURIComponent(auth.user.uid)}`,
  );

  if (!profileResult.response.ok) {
    return buildGuestBffResult({
      status: profileResult.response.status || 502,
      data: {
        viewer: auth.user,
        unreadCount: auth.unreadNotificationCount,
        profile: auth.profile || null,
        events: { upcoming: [], attended: [] },
        badges: buildProfileBadges(auth.profile),
      },
      error: buildGuestBffError(
        getGuestBffUpstreamError(profileResult.data, "Failed to load profile."),
        {
          requestId: profileResult.requestId,
          status: profileResult.response.status || 502,
        },
      ),
      meta: {
        requestId: authResult.requestId,
        upstreamCalls: buildGuestBffUpstreamTrace(authResult, profileResult),
      },
    });
  }

  const profile = profileResult.data?.profile || auth.profile || null;
  const events = profileResult.data?.events || { upcoming: [], attended: [] };

  return buildGuestBffResult({
    status: 200,
    data: {
      viewer: auth.user,
      unreadCount: auth.unreadNotificationCount,
      profile,
      events,
      badges: buildProfileBadges(profile),
    },
    meta: {
      requestId: authResult.requestId,
      upstreamCalls: buildGuestBffUpstreamTrace(authResult, profileResult),
    },
  });
}

function normalizePublicProfilePayload(data = {}, userId) {
  return {
    profile: {
      avatar: data.avatar || data.photoURL || null,
      bio: data.bio || "",
      city: data.city || null,
      createdAt: data.createdAt || null,
      displayName: data.displayName || data.name || "Member",
      email: data.email,
      gender: data.gender || null,
      hostStatus: data.hostStatus || null,
      photoURL: data.photoURL || data.avatar || null,
      uid: data.uid || data.id || userId,
    },
    events: {
      attended: [],
      upcoming: [],
    },
  };
}

export async function buildProfileDetailView(userId) {
  const authResult = await guestBffUpstreamJson("/auth/me");
  const auth = authResult.response.ok
    ? normalizeBootstrapPayload(authResult.data)
    : { user: null, profile: null, unreadNotificationCount: 0 };
  const isOwner = Boolean(auth?.user?.uid && auth.user.uid === userId);

  const profileResult = await guestBffUpstreamJson(
    isOwner
      ? `/guest-profiles/${encodeURIComponent(userId)}`
      : `/profiles/${encodeURIComponent(userId)}`,
  );

  if (!profileResult.response.ok) {
    return buildGuestBffResult({
      status: profileResult.response.status || 404,
      data: {
        viewer: auth.user,
        unreadCount: auth.unreadNotificationCount || 0,
        isOwner,
        profile: null,
        events: { upcoming: [], attended: [] },
        badges: [],
      },
      error: buildGuestBffError(
        getGuestBffUpstreamError(profileResult.data, "Profile not found."),
        {
          requestId: profileResult.requestId,
          status: profileResult.response.status || 404,
        },
      ),
      meta: {
        isOwner,
        requestId: authResult.requestId,
        upstreamCalls: buildGuestBffUpstreamTrace(authResult, profileResult),
      },
    });
  }

  const normalized = isOwner
    ? {
        profile: profileResult.data?.profile || auth.profile || null,
        events: profileResult.data?.events || { upcoming: [], attended: [] },
      }
    : normalizePublicProfilePayload(profileResult.data, userId);
  const profile = normalized.profile;

  return buildGuestBffResult({
    status: 200,
    data: {
      viewer: auth.user,
      unreadCount: auth.unreadNotificationCount || 0,
      isOwner,
      profile,
      events: normalized.events,
      badges: buildProfileBadges(profile),
    },
    meta: {
      isOwner,
      requestId: authResult.requestId,
      upstreamCalls: buildGuestBffUpstreamTrace(authResult, profileResult),
    },
  });
}

export async function runProfileUpdate(body = {}, requestHeaders = {}) {
  const result = await guestBffUpstreamJson("/profiles", {
    body,
    headers: requestHeaders,
    method: "PATCH",
  });

  return buildGuestBffResult({
    status: result.response.ok ? 200 : result.response.status || 422,
    data: result.response.ok ? result.data : null,
    error: result.response.ok
      ? null
      : buildGuestBffError(
          getGuestBffUpstreamError(result.data, "Unable to update profile."),
          {
            requestId: result.requestId,
            status: result.response.status || 422,
          },
        ),
    meta: {
      requestId: result.requestId,
      upstreamCalls: buildGuestBffUpstreamTrace(result),
    },
  });
}
