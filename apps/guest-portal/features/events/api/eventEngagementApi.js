'use client';

import { getApiErrorMessage, guestApiOperationJson, guestApi } from '../../../lib/api/client';

export function trackEventImpression(eventId, promoterRef) {
  if (!eventId) return Promise.resolve();
  const body = promoterRef ? { type: 'impression', ref: promoterRef } : { type: 'impression' };
  return guestApi.events.track(eventId, body);
}

export async function recordPromoterLinkClick(code, eventId) {
  if (!code) return null;
  const { response, data } = await guestApi.promoters.trackClick({ code, eventId });
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, 'Unable to track promoter link click'));
  }
  return data;
}

export async function recordEventView(eventId) {
  if (!eventId) return null;
  const { response, data } = await guestApi.events.view(eventId);
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, 'Unable to record event view'));
  }
  return data;
}

export async function setEventRsvp(eventId, shouldInclude) {
  const { response, data } = await guestApi.events.rsvp(eventId, { shouldInclude });
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, 'Unable to update RSVP'));
  }
  return data;
}

export async function getEventQueueStatus(eventId, query = {}, options = {}) {
  const { response, data } = await guestApi.events.queue(eventId, query, options);
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, 'Unable to load queue status'));
  }
  return data;
}

export function joinEventTierWaitlist(eventId, tierId) {
  return guestApiOperationJson('joinWaitlist', {
    body: {
      eventId,
      tierId,
    },
  });
}
