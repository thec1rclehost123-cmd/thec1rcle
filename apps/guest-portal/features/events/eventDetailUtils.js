export const AMBIENT_DOTS = [
  { left: '6%', size: 4, duration: 11, delay: 0.2, drift: 18 },
  { left: '12%', size: 6, duration: 14, delay: 1.1, drift: -22 },
  { left: '18%', size: 5, duration: 10, delay: 0.6, drift: 16 },
  { left: '25%', size: 4, duration: 15, delay: 2.1, drift: -18 },
  { left: '33%', size: 6, duration: 12, delay: 1.7, drift: 24 },
  { left: '41%', size: 4, duration: 16, delay: 0.4, drift: -14 },
  { left: '49%', size: 5, duration: 13, delay: 2.6, drift: 20 },
  { left: '57%', size: 4, duration: 11, delay: 1.3, drift: -26 },
  { left: '64%', size: 6, duration: 15, delay: 0.9, drift: 18 },
  { left: '72%', size: 4, duration: 12, delay: 2.8, drift: -20 },
  { left: '81%', size: 5, duration: 14, delay: 0.7, drift: 22 },
  { left: '90%', size: 4, duration: 10, delay: 1.9, drift: -16 },
  { left: '3%', size: 3, duration: 13, delay: 2.4, drift: 12 },
  { left: '9%', size: 5, duration: 9, delay: 3.1, drift: -15 },
  { left: '15%', size: 3, duration: 16, delay: 1.4, drift: 14 },
  { left: '21%', size: 4, duration: 12, delay: 0.8, drift: -12 },
  { left: '28%', size: 3, duration: 15, delay: 2.9, drift: 18 },
  { left: '36%', size: 5, duration: 11, delay: 1.9, drift: -20 },
  { left: '45%', size: 3, duration: 14, delay: 3.5, drift: 16 },
  { left: '53%', size: 4, duration: 10, delay: 0.5, drift: -18 },
  { left: '61%', size: 3, duration: 17, delay: 2.2, drift: 15 },
  { left: '69%', size: 5, duration: 12, delay: 1.2, drift: -14 },
  { left: '77%', size: 3, duration: 15, delay: 3.3, drift: 17 },
  { left: '85%', size: 4, duration: 11, delay: 0.9, drift: -19 },
  { left: '94%', size: 3, duration: 16, delay: 2.7, drift: 13 },
];

export function formatINR(amount) {
  const value = Number(amount || 0);
  return `₹${value.toLocaleString('en-IN')}`;
}

export function formatDisplayTitle(value) {
  return String(value || 'Event Detail')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

export function truncateCopy(value, maxLength = 180) {
  if (!value) return '';
  const normalized = String(value).replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

export function resolveEventImage(event) {
  if (!event) return null;
  return (
    event.image ||
    event.poster ||
    event.posterUrl ||
    event.flyer ||
    event.flyerUrl ||
    (Array.isArray(event.images) ? event.images[0] : null) ||
    (Array.isArray(event.gallery) ? event.gallery[0] : null) ||
    null
  );
}

export function resolveBackdropPoster(event) {
  if (!event) return null;
  return (
    event.poster ||
    event.posterUrl ||
    event.flyer ||
    event.flyerUrl ||
    event.image ||
    (Array.isArray(event.gallery) ? event.gallery[0] : null) ||
    (Array.isArray(event.images) ? event.images[0] : null) ||
    null
  );
}

export function parseParagraphs(value) {
  if (!value) return [];
  return String(value)
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatTimeLabel(event) {
  if (event?.startTime || event?.endTime) {
    if (event.startTime && event.endTime) {
      return `${event.startTime} - ${event.endTime}`;
    }
    return event.startTime || event.endTime || '';
  }

  if (!event?.startDate) return '';

  try {
    const formatter = new Intl.DateTimeFormat('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    });
    const startLabel = formatter.format(new Date(event.startDate));
    if (!event?.endDate) return startLabel;
    const endLabel = formatter.format(new Date(event.endDate));
    return `${startLabel} - ${endLabel}`;
  } catch {
    return '';
  }
}

export function buildHostUrl(host) {
  const target = host?.username || host?.handle || host?.slug || host?.id;
  if (!target) return '/explore';
  return host?.type === 'venue'
    ? `/venue/${encodeURIComponent(target)}`
    : `/${encodeURIComponent(target)}`;
}

export function buildPosterGradient(event) {
  if (event?.gradientStart && event?.gradientEnd) {
    return `linear-gradient(160deg, ${event.gradientStart} 0%, ${event.gradientEnd} 100%)`;
  }
  const category = String(event?.category || '').toLowerCase();
  if (category.includes('fashion')) {
    return 'linear-gradient(160deg, #ff9a62 0%, #f44a22 42%, #2a0805 100%)';
  }
  if (category.includes('art')) {
    return 'linear-gradient(160deg, #ff9057 0%, #d13b1b 40%, #120404 100%)';
  }
  return 'linear-gradient(160deg, #ff7a18 0%, #f44a22 34%, #5c150f 62%, #080304 100%)';
}

export function buildGoingLabel(interestedData) {
  const count = interestedData?.count || 0;
  const leadName = interestedData?.users?.[0]?.name || interestedData?.users?.[0]?.displayName;
  if (leadName && count > 1) {
    return `${leadName} and ${(count - 1).toLocaleString('en-IN')} others going`;
  }
  if (count > 0) {
    return `${count.toLocaleString('en-IN')} going`;
  }
  return '';
}

export function buildTagline(event) {
  const primary = truncateCopy(event?.summary || parseParagraphs(event?.description)?.[0], 110);
  if (primary) return primary;
  return '';
}

export function getTierBadge(ticket, startingPrice) {
  const name = String(ticket?.name || '').toLowerCase();
  const entryType = String(ticket?.entryType || '').toLowerCase();

  if (name.includes('vip') || entryType === 'vip' || entryType === 'backstage') {
    return { label: 'VIP', classes: 'border-amber-300/20 bg-amber-300/10 text-amber-100' };
  }
  if (name.includes('couple') || entryType === 'couple') {
    return { label: 'Couple', classes: 'border-rose-300/20 bg-rose-300/10 text-rose-100' };
  }
  if (name.includes('ladies') || name.includes('female') || ticket?.gender === 'female') {
    return { label: 'Ladies', classes: 'border-pink-300/20 bg-pink-300/10 text-pink-100' };
  }
  if (
    Number(ticket?.price || 0) === Number(startingPrice || 0) &&
    String(ticket?.name || '')
      .toLowerCase()
      .includes('early')
  ) {
    return { label: 'Early', classes: 'border-white/[0.15] bg-white/[0.08] text-white' };
  }
  return null;
}

export function resolveInstagramProfile(host) {
  const raw =
    host?.socialLinks?.instagram ||
    host?.instagram ||
    host?.instagramHandle ||
    host?.contact?.instagram ||
    (String(host?.handle || '').startsWith('@') ? host.handle : null);

  if (!raw) return null;

  const normalized = String(raw).trim();
  if (!normalized) return null;

  if (normalized.includes('instagram.com')) {
    const url = normalized.startsWith('http') ? normalized : `https://${normalized}`;
    const match = url.match(/instagram\.com\/([^/?#]+)/i);
    const handle = match?.[1] || 'instagram';
    return { url, label: `@${handle.replace(/^@/, '')}` };
  }

  const handle = normalized.replace(/^@/, '');
  return {
    url: `https://instagram.com/${handle}`,
    label: `@${handle}`,
  };
}

export function formatDateShort(event) {
  if (!event?.startDate) return 'Date TBA';
  try {
    const d = new Date(event.startDate);
    const day = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Kolkata' });
    const month = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'Asia/Kolkata' });
    const date = d.toLocaleDateString('en-US', { day: '2-digit', timeZone: 'Asia/Kolkata' });
    return `${day}, ${month} ${date}`;
  } catch {
    return 'Date TBA';
  }
}

export function formatTimeShort(event) {
  if (event?.startTime) return event.startTime;
  if (!event?.startDate) return '';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    }).format(new Date(event.startDate));
  } catch {
    return '';
  }
}
