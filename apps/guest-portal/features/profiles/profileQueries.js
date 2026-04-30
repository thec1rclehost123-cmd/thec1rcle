"use client";

import { useQuery } from "@tanstack/react-query";
import { getApiErrorMessage, guestApi } from "../../lib/api/client";
import { isGuestBffEnabled } from "../../lib/bff/flags.js";
import { fetchGuestBffProfileDetail } from "../../lib/bff/fetchers.js";
import { logGuestBffParity } from "../../lib/bff/parity.js";

export function guestProfileQueryKey(userId, viewerId) {
  return ["profile", userId, viewerId || "anonymous"];
}

export async function fetchGuestProfile(userId, viewerId) {
  if (isGuestBffEnabled("profile")) {
    const overview = await fetchGuestBffProfileDetail(userId);
    const nextData = {
      profile: overview?.profile || null,
      events: overview?.events || { upcoming: [], attended: [] },
      badges: overview?.badges || [],
      unreadCount: overview?.unreadCount || 0,
      isOwner: Boolean(overview?.isOwner),
      viewer: overview?.viewer || null,
    };

    try {
      const { response, data } = await guestApi.profiles.get(userId, { credentials: "include" });
      if (response.ok) {
        logGuestBffParity("profile.detail", data, nextData, {
          userId,
          viewerId,
        });
      }
    } catch {}

    return nextData;
  }

  const { response, data } = await guestApi.profiles.get(userId, { credentials: "include" });
  if (!response.ok) throw new Error(getApiErrorMessage(data, "Profile not found"));
  return data;
}

export function useGuestProfileQuery({ userId, viewerId }) {
  return useQuery({
    queryKey: guestProfileQueryKey(userId, viewerId),
    queryFn: async () => fetchGuestProfile(userId, viewerId),
    enabled: Boolean(userId) && userId !== "[userId]",
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
