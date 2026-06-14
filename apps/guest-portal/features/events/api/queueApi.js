"use client";

import { getApiErrorMessage, guestApi } from "../../../lib/api/client";

export async function fetchQueueEventPreview(eventId) {
  const { response, data } = await guestApi.public.event(eventId);
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, "Failed to load event preview"));
  }
  return data?.event || null;
}

export async function fetchQueueStatus(eventId, queueId) {
  const { response, data } = await guestApi.events.queue(eventId, { queueId });
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, "Failed to fetch queue status"));
  }
  return data;
}

export async function joinEventQueue(eventId) {
  const { response, data } = await guestApi.events.joinQueue(eventId, {});
  return {
    data,
    ok: response.ok,
    statusCode: response.status,
  };
}
