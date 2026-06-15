import { guestBffJson, getGuestBffErrorMessage, unwrapGuestBffPayload } from './client.js';

async function request(path, options, fallbackMessage) {
  const { response, data } = await guestBffJson(path, options);
  if (!response.ok) {
    throw new Error(getGuestBffErrorMessage(data, fallbackMessage));
  }
  return unwrapGuestBffPayload(data);
}

export async function fetchGuestBffTicketsOverview(options = {}) {
  return request('/tickets/overview', options, 'Failed to load ticket overview.');
}

export async function fetchGuestBffEventDetail(eventId, options = {}) {
  const { response, data } = await guestBffJson(
    `/events/${encodeURIComponent(eventId)}/detail`,
    options,
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(getGuestBffErrorMessage(data, 'Unable to load event detail.'));
  }
  return unwrapGuestBffPayload(data);
}

export async function fetchGuestBffCheckoutSummary(body, options = {}) {
  const { response, data } = await guestBffJson('/checkout/summary', {
    method: 'POST',
    body,
    ...options,
  });
  if (response.status === 404) return unwrapGuestBffPayload(data);
  if (!response.ok) {
    throw new Error(getGuestBffErrorMessage(data, 'Unable to refresh checkout summary.'));
  }
  return unwrapGuestBffPayload(data);
}

export async function fetchGuestBffProfileOverview(options = {}) {
  return request('/profile/overview', options, 'Unable to load profile overview.');
}

export async function fetchGuestBffNotificationsSummary(query = {}, options = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }

  return request(
    `/notifications/summary${params.toString() ? `?${params.toString()}` : ''}`,
    options,
    'Unable to load notifications summary.',
  );
}

export async function fetchGuestBffExploreFeed(query = {}, options = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }

  return request(
    `/explore/feed${params.toString() ? `?${params.toString()}` : ''}`,
    options,
    'Unable to load explore feed.',
  );
}

export async function fetchGuestBffHomeOverview(query = {}, options = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }

  return request(
    `/home/overview${params.toString() ? `?${params.toString()}` : ''}`,
    options,
    'Unable to load homepage overview.',
  );
}

export async function fetchGuestBffConfirmation(orderId, options = {}) {
  const { response, data } = await guestBffJson(
    `/orders/${encodeURIComponent(orderId)}/confirmation`,
    options,
  );
  if ([401, 403, 404].includes(response.status)) {
    return unwrapGuestBffPayload(data);
  }
  if (!response.ok) {
    throw new Error(getGuestBffErrorMessage(data, 'Unable to load order confirmation.'));
  }
  return unwrapGuestBffPayload(data);
}

export async function fetchGuestBffProfileDetail(userId, options = {}) {
  return request(
    `/profiles/${encodeURIComponent(userId)}/detail`,
    options,
    'Unable to load profile detail.',
  );
}
