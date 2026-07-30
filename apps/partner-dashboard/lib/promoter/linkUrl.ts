type PromoterLinkUrlInput = {
  code?: string | null;
  eventId?: string | null;
  eventSlug?: string | null;
  fullUrl?: string | null;
  channel?: string | null;
  promoterHandle?: string | null;
  vanityAlias?: string | null;
  vanityPrefix?: string | null;
  vanitySlug?: string | null;
};

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

export function buildPromoterVanityPrefix(link: PromoterLinkUrlInput, guestPortalUrl: string) {
  const configuredPrefix =
    String(link.vanityPrefix || '').trim() ||
    (link.promoterHandle ? `/${String(link.promoterHandle).replace(/^@/, '')}/` : '');
  if (!configuredPrefix) return '';
  if (/^https?:\/\//i.test(configuredPrefix)) return configuredPrefix;

  const base = trimTrailingSlash(String(guestPortalUrl || '').trim());
  const path = configuredPrefix.startsWith('/') ? configuredPrefix : `/${configuredPrefix}`;
  return `${base}${path}`;
}

export function buildPromoterShareUrl(
  link: PromoterLinkUrlInput,
  guestPortalUrl: string,
  fallbackEventSlug?: string | null,
) {
  if (link.fullUrl && !link.vanityAlias && !link.vanitySlug) return link.fullUrl;

  const vanityAlias = link.vanityAlias || link.vanitySlug;
  if (vanityAlias) {
    const vanityPrefix = buildPromoterVanityPrefix(link, guestPortalUrl);
    if (vanityPrefix) return `${vanityPrefix}${vanityAlias}`;
  }

  const base = trimTrailingSlash(String(guestPortalUrl || '').trim());
  const eventSlug = link.eventSlug || link.eventId || fallbackEventSlug || '';
  const ref = link.code || '';
  const channel = link.channel ? `&s=${encodeURIComponent(link.channel)}` : '';
  return `${base}/event/${encodeURIComponent(eventSlug)}?ref=${encodeURIComponent(ref)}${channel}`;
}
