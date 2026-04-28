import { guestServerJson } from "../../lib/api/server";

export async function loadVanityLink(handle, eventSlug, options = {}) {
  if (!handle || !eventSlug) return null;
  const { response, data } = await guestServerJson(
    `/public/promoters/${encodeURIComponent(handle)}/links/${encodeURIComponent(eventSlug)}`,
    { forwardCookies: false, next: { revalidate: 30 }, ...options }
  );

  if (!response.ok) return null;
  return data?.link || null;
}

export function buildVanityRedirectTarget(link, searchParams = {}) {
  const eventIdentifier = link?.eventSlug || link?.eventId;
  if (!eventIdentifier) return null;

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams || {})) {
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, String(item));
    } else if (value !== undefined && value !== null) {
      query.set(key, String(value));
    }
  }
  if (link?.code) query.set("ref", String(link.code));

  const queryString = query.toString();
  return `/event/${encodeURIComponent(eventIdentifier)}${queryString ? `?${queryString}` : ""}`;
}
