"use client";

import { getApiErrorMessage, guestApi } from "../../../lib/api/client";

async function requireOk(request, fallbackMessage) {
  const { response, data } = await request();
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, fallbackMessage));
  }
  return data;
}

export async function getHostFollowStatus(targetId) {
  if (!targetId) return false;
  const data = await requireOk(
    () => guestApi.social.followStatus(targetId),
    "Unable to load follow status"
  );
  return Boolean(data?.following);
}

export async function followHost(targetId) {
  return requireOk(
    () => guestApi.social.follow({ targetId, targetType: "host" }),
    "Unable to follow host"
  );
}

export async function unfollowHost(targetId) {
  return requireOk(
    () => guestApi.social.unfollow(targetId, "host"),
    "Unable to unfollow host"
  );
}

export async function getVenueFollowStatus(venueId) {
  if (!venueId) return false;
  const data = await requireOk(
    () => guestApi.venues.followStatus(venueId),
    "Unable to load venue follow status"
  );
  return Boolean(data?.isFollowing);
}

export async function followVenue(venueId) {
  return requireOk(
    () => guestApi.venues.follow(venueId),
    "Unable to follow venue"
  );
}

export async function unfollowVenue(venueId) {
  return requireOk(
    () => guestApi.venues.unfollow(venueId),
    "Unable to unfollow venue"
  );
}
