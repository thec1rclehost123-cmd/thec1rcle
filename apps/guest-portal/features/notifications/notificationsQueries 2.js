"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { guestApi, getApiErrorMessage } from "../../lib/api/client";

const NOTIFICATIONS_ROOT_QUERY_KEY = ["guest", "notifications"];
const NOTIFICATIONS_STALE_MS = 30 * 1000;

export function guestNotificationsQueryKey(uid, filters = {}) {
  return [
    ...NOTIFICATIONS_ROOT_QUERY_KEY,
    "list",
    uid || "anonymous",
    filters.unreadOnly === true ? "unread" : "all",
    filters.limit || 50,
  ];
}

export function guestUnreadNotificationCountQueryKey(uid) {
  return [...NOTIFICATIONS_ROOT_QUERY_KEY, "unread-count", uid || "anonymous"];
}

export async function fetchGuestNotifications({ unreadOnly = false, limit = 50 } = {}) {
  const params = new URLSearchParams();
  if (unreadOnly) params.set("unreadOnly", "true");
  if (limit) params.set("limit", String(limit));

  const query = params.toString() ? `?${params.toString()}` : "";
  const { response, data } = await guestApi.notifications.list(query);
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, "Failed to load notifications"));
  }
  return data?.notifications || [];
}

export async function fetchGuestUnreadNotificationCount() {
  const { response, data } = await guestApi.notifications.unreadCount();
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, "Failed to load notification count"));
  }
  return { unreadCount: data?.unreadCount || 0 };
}

export async function markAllGuestNotificationsRead() {
  const { response, data } = await guestApi.notifications.markAllRead();
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, "Failed to mark notifications read"));
  }
  return data;
}

export async function markGuestNotificationRead(id) {
  const { response, data } = await guestApi.notifications.markRead(id);
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, "Failed to mark notification read"));
  }
  return data;
}

export function useGuestNotificationsQuery(uid, filters = {}, options = {}) {
  return useQuery({
    queryKey: guestNotificationsQueryKey(uid, filters),
    queryFn: () => fetchGuestNotifications(filters),
    enabled: Boolean(uid) && options.enabled !== false,
    staleTime: NOTIFICATIONS_STALE_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    ...options,
  });
}

export function useGuestUnreadNotificationCountQuery(uid, options = {}) {
  return useQuery({
    queryKey: guestUnreadNotificationCountQueryKey(uid),
    queryFn: fetchGuestUnreadNotificationCount,
    enabled: Boolean(uid) && options.enabled !== false,
    staleTime: NOTIFICATIONS_STALE_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    ...options,
  });
}

export function useMarkAllGuestNotificationsReadMutation(uid, options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: markAllGuestNotificationsRead,
    onSuccess: async (...args) => {
      await invalidateGuestNotifications(queryClient, uid);
      await options.onSuccess?.(...args);
    },
  });
}

export function useMarkGuestNotificationReadMutation(uid, options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: markGuestNotificationRead,
    onSuccess: async (...args) => {
      await invalidateGuestNotifications(queryClient, uid);
      await options.onSuccess?.(...args);
    },
  });
}

export async function invalidateGuestNotifications(queryClient, uid) {
  if (!queryClient) return;
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: guestUnreadNotificationCountQueryKey(uid) }),
    queryClient.invalidateQueries({ queryKey: [...NOTIFICATIONS_ROOT_QUERY_KEY, "list", uid || "anonymous"] }),
  ]);
}
