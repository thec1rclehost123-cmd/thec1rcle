/**
 * THE C1RCLE - Shared Event Utilities
 * Source of truth for lifecycle states, city normalization, and event mapping.
 */

// --- 1. Lifecycle States ---
export const EVENT_LIFECYCLE = {
  DRAFT: 'draft', // Private working state, creator only
  SUBMITTED: 'submitted', // Host submitted to venue for approval
  NEEDS_CHANGES: 'needs_changes', // Venue sent back to host for revision
  APPROVED: 'approved', // Venue approved host request — internal pre-publish state
  SCHEDULED: 'scheduled', // Publicly visible upcoming event, ticket-selling state
  LIVE: 'live', // Currently happening
  COMPLETED: 'completed', // Event ended, read-only
  PAUSED: 'paused', // Temporarily hidden / ticket sales suspended
  CANCELLED: 'cancelled', // Cancelled, visible only where appropriate
  DENIED: 'denied', // Venue rejected host request
  DELETED: 'deleted', // Soft-deleted
};

/**
 * States that appear in the guest-facing public portal (explore, search, event pages).
 * approved is intentionally excluded — it is an internal pre-publish state.
 */
export const PUBLIC_LIFECYCLE_STATES = [EVENT_LIFECYCLE.SCHEDULED, EVENT_LIFECYCLE.LIVE];

// --- 2. Shared Lifecycle Helpers ---

/**
 * Is this lifecycle visible to guests in the public portal?
 * Use this instead of hardcoding lifecycle strings in components.
 */
export function isPublicLifecycle(lifecycle) {
  return PUBLIC_LIFECYCLE_STATES.includes(lifecycle);
}

/**
 * Is this an upcoming or ongoing event (suitable for discovery feeds)?
 * Excludes completed, cancelled, paused, denied, deleted.
 */
export function isUpcomingLifecycle(lifecycle) {
  return lifecycle === EVENT_LIFECYCLE.SCHEDULED || lifecycle === EVENT_LIFECYCLE.LIVE;
}

/**
 * Does this event require venue approval before it can be published?
 * Only host-created events go through the approval flow.
 */
export function requiresVenueApproval(event) {
  const role = event.creatorRole || event.eventType;
  return role === 'host';
}

/**
 * Can a promoter see this event in their discovery view?
 * Requires both public visibility AND promotersEnabled flag.
 */
export function canPromoterSee(event) {
  const isPublic = isPublicLifecycle(event.lifecycle);
  const promotersEnabled =
    event.promotersEnabled === true || event.promoterSettings?.enabled === true;
  return isPublic && promotersEnabled;
}

function getPromoterTierCatalog(event) {
  if (Array.isArray(event?.ticketCatalog?.tiers)) return event.ticketCatalog.tiers;
  if (Array.isArray(event?.tickets)) return event.tickets;
  return [];
}

function getTierNumericPrice(tier) {
  const rawPrice = tier?.price ?? tier?.basePrice ?? tier?.amount ?? 0;
  const normalized = Number(rawPrice);
  return Number.isFinite(normalized) ? normalized : 0;
}

export function getPromoterEligibleTicketTiers(event) {
  if (!event || event.isRSVP === true) return [];

  return getPromoterTierCatalog(event).filter((tier) => {
    if (!tier || tier.promoterEnabled === false) return false;
    return getTierNumericPrice(tier) > 0;
  });
}

export function hasPromoterEligibleTicketTiers(event) {
  return getPromoterEligibleTicketTiers(event).length > 0;
}

/**
 * Can a promoter create a personal link for this event?
 * Currently same as visibility logic, but separated for future extensibility (e.g. invite-only).
 */
export function canPromoterCreateLink(event) {
  return canPromoterSee(event) && event?.isRSVP !== true && hasPromoterEligibleTicketTiers(event);
}

/**
 * Can the given actor edit this event?
 * - venue: can edit their own draft events
 * - host: can edit their own draft or needs_changes events
 * - admin: can always edit
 */
export function isEditableEvent(event, actorRole) {
  if (actorRole === 'admin') return true;
  const lc = event.lifecycle;
  if (actorRole === 'venue' && (event.creatorRole || event.eventType) === 'venue') {
    return lc === EVENT_LIFECYCLE.DRAFT;
  }
  if (actorRole === 'host' && (event.creatorRole || event.eventType) === 'host') {
    return lc === EVENT_LIFECYCLE.DRAFT || lc === EVENT_LIFECYCLE.NEEDS_CHANGES;
  }
  return false;
}

/**
 * Returns the set of lifecycle values the actor can transition this event to.
 * Used to validate PATCH /events/:id/lifecycle requests.
 */
export function getNextAllowedTransitions(event, actorRole) {
  const lc = event.lifecycle;
  const role = event.creatorRole || event.eventType;

  if (actorRole === 'admin') {
    return Object.values(EVENT_LIFECYCLE).filter((s) => s !== lc);
  }

  if (actorRole === 'venue') {
    if (role === 'venue') {
      if (lc === EVENT_LIFECYCLE.DRAFT)
        return [EVENT_LIFECYCLE.SCHEDULED, EVENT_LIFECYCLE.APPROVED, EVENT_LIFECYCLE.CANCELLED];
      if (lc === EVENT_LIFECYCLE.APPROVED)
        return [EVENT_LIFECYCLE.SCHEDULED, EVENT_LIFECYCLE.CANCELLED];
      if (lc === EVENT_LIFECYCLE.SCHEDULED)
        return [EVENT_LIFECYCLE.LIVE, EVENT_LIFECYCLE.PAUSED, EVENT_LIFECYCLE.CANCELLED];
      if (lc === EVENT_LIFECYCLE.LIVE)
        return [EVENT_LIFECYCLE.COMPLETED, EVENT_LIFECYCLE.PAUSED, EVENT_LIFECYCLE.CANCELLED];
      if (lc === EVENT_LIFECYCLE.PAUSED)
        return [EVENT_LIFECYCLE.SCHEDULED, EVENT_LIFECYCLE.LIVE, EVENT_LIFECYCLE.CANCELLED];
    }
    if (role === 'host') {
      // Venue reviewing a host submission
      if (lc === EVENT_LIFECYCLE.SUBMITTED)
        return [EVENT_LIFECYCLE.APPROVED, EVENT_LIFECYCLE.NEEDS_CHANGES, EVENT_LIFECYCLE.DENIED];
      if (lc === EVENT_LIFECYCLE.APPROVED)
        return [EVENT_LIFECYCLE.SCHEDULED, EVENT_LIFECYCLE.CANCELLED];
      if (lc === EVENT_LIFECYCLE.SCHEDULED)
        return [EVENT_LIFECYCLE.LIVE, EVENT_LIFECYCLE.PAUSED, EVENT_LIFECYCLE.CANCELLED];
      if (lc === EVENT_LIFECYCLE.LIVE)
        return [EVENT_LIFECYCLE.COMPLETED, EVENT_LIFECYCLE.PAUSED, EVENT_LIFECYCLE.CANCELLED];
      if (lc === EVENT_LIFECYCLE.PAUSED)
        return [EVENT_LIFECYCLE.SCHEDULED, EVENT_LIFECYCLE.LIVE, EVENT_LIFECYCLE.CANCELLED];
    }
  }

  if (actorRole === 'host') {
    if (lc === EVENT_LIFECYCLE.DRAFT) return [EVENT_LIFECYCLE.SUBMITTED];
    if (lc === EVENT_LIFECYCLE.NEEDS_CHANGES) return [EVENT_LIFECYCLE.SUBMITTED];
  }

  return [];
}

// --- 4. City Normalization ---
export const CITY_MAP = [
  {
    key: 'pune-in',
    label: 'Pune, IN',
    matches: ['pune', 'kp', 'koregaon', 'baner', 'viman', 'magarpatta', 'hinjewadi', 'kalyani'],
  },
  {
    key: 'mumbai-in',
    label: 'Mumbai, IN',
    matches: [
      'mumbai',
      'bandra',
      'andheri',
      'juhu',
      'worli',
      'colaba',
      'powai',
      'thane',
      'navi mumbai',
    ],
  },
  {
    key: 'bengaluru-in',
    label: 'Bengaluru, IN',
    matches: [
      'bangalore',
      'bengaluru',
      'blr',
      'koramangala',
      'indiranagar',
      'hsr',
      'whitefield',
      'electronic city',
    ],
  },
  {
    key: 'goa-in',
    label: 'Goa, IN',
    matches: [
      'goa',
      'anjuna',
      'morjim',
      'panjim',
      'panaji',
      'vagator',
      'baga',
      'calangute',
      'siolim',
      'assagao',
    ],
  },
  {
    key: 'delhi-in',
    label: 'Delhi NCR, IN',
    matches: ['delhi', 'gurgaon', 'noida', 'ncr', 'saket', 'hauz khas', 'gurugram'],
  },
  {
    key: 'hyderabad-in',
    label: 'Hyderabad, IN',
    matches: ['hyderabad', 'jubilee', 'banjara', 'hitech', 'gachibowli'],
  },
  {
    key: 'chennai-in',
    label: 'Chennai, IN',
    matches: ['chennai', 'madras', 'adyar', 'velachery', 'omr'],
  },
  {
    key: 'kolkata-in',
    label: 'Kolkata, IN',
    matches: ['kolkata', 'calcutta', 'salt lake', 'new town'],
  },
  { key: 'jaipur-in', label: 'Jaipur, IN', matches: ['jaipur', 'pink city'] },
  { key: 'chandigarh-in', label: 'Chandigarh, IN', matches: ['chandigarh', 'mohali', 'panchkula'] },
];

export function normalizeCity(cityStr, locationStr = '') {
  const input = `${cityStr || ''} ${locationStr || ''}`.toLowerCase();

  // Find first matching city
  const found = CITY_MAP.find(
    (c) =>
      c.matches.some((m) => input.includes(m)) ||
      input.includes(c.key) ||
      input.includes(c.label.toLowerCase()),
  );

  return found ? found.key : 'other-in';
}

export function getCityLabel(key) {
  const found = CITY_MAP.find((c) => c.key === key);
  return found ? found.label : 'Other City, IN';
}

// --- 5. Partner Normalization ---
export const slugifyPartnerValue = (value) => {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

/**
 * Normalizes a Partner (Venue or Host) document into a standard snapshot.
 * Used for denormalized storage in events and orders.
 */
export function buildPartnerSnapshot(doc, type, fallbackName) {
  // If doc is already a snapshot/data object, use it directly
  const data = doc && typeof doc.data === 'function' ? doc.data() : doc || {};
  const id = (doc && doc.id) || data.id || '';

  const name =
    data.name || data.displayName || data.venueName || data.hostName || fallbackName || id;

  const handle = data.handle || null;
  const slug = data.slug || slugifyPartnerValue(handle || name || id) || id;

  const photoURL = data.photoURL || data.avatar || data.image || data.logo || null;
  const coverURL = data.coverURL || data.cover || data.image || null;

  return {
    id,
    type,
    slug,
    handle,
    name,
    avatar: data.avatar || photoURL,
    photoURL,
    image: data.image || photoURL,
    cover: data.cover || coverURL,
    coverURL,
    verified: Boolean(data.verified),
    role: data.role || type,
    city: data.city || null,
    neighborhood: data.neighborhood || null,
  };
}

// --- 6. Canonical Media Resolver ---
export function resolvePoster(event) {
  if (!event) return '/events/placeholder.svg';

  const isInternalPlaceholder = (url) => {
    if (!url || typeof url !== 'string') return false;
    return url.includes('placeholder.svg') || url.includes('holi-edit.svg');
  };

  // Priority order for fields
  const poster = event.poster || event.image || event.flyer;
  if (poster && typeof poster === 'string' && !isInternalPlaceholder(poster)) {
    return poster;
  }

  // Check gallery/images arrays
  if (Array.isArray(event.images) && event.images.length > 0) {
    const first = event.images[0];
    if (first && !isInternalPlaceholder(first)) return first;
  }
  if (Array.isArray(event.gallery) && event.gallery.length > 0) {
    const first = event.gallery[0];
    if (first && !isInternalPlaceholder(first)) return first;
  }

  // If we have something but it was a placeholder, and we found nothing better,
  // we still return the original poster if it exists, otherwise the default.
  return poster && typeof poster === 'string' ? poster : '/events/placeholder.svg';
}

// --- 6. Canonical Event Mapper ---
/**
 * Maps a raw Firestore document to a consistent client-side object.
 * Used by Guest Portal, Partner Dashboard, and Admin Console.
 */
export function mapEventForClient(data, id) {
  if (!data) return null;

  const eventId = id || data.id || data.slug;
  const poster = resolvePoster(data);
  const cityKey = data.cityKey || normalizeCity(data.city, data.location);

  // Clean sensitive data (e.g. password codes for public consumption)
  const settings = data.settings ? { ...data.settings } : {};
  if (settings.passwordCode) delete settings.passwordCode;

  const creatorRole = data.creatorRole || (data.hostId ? 'host' : 'venue');
  const eventType = creatorRole === 'host' ? 'host' : 'venue';
  let lifecycle = data.lifecycle || data.status || EVENT_LIFECYCLE.DRAFT;

  // Normalization: venue events never require approval and are never approved or submitted.
  // Normalize legacy 'submitted', 'pending', and 'approved' states for venue events.
  if (
    eventType === 'venue' &&
    (lifecycle === EVENT_LIFECYCLE.SUBMITTED ||
      lifecycle === 'pending' ||
      lifecycle === EVENT_LIFECYCLE.APPROVED)
  ) {
    lifecycle = EVENT_LIFECYCLE.SCHEDULED;
  }

  // Derived Permission Flags (True for Club/Admin viewing in Partner Dashboard)
  const canApprove = eventType === 'host' && lifecycle === EVENT_LIFECYCLE.SUBMITTED;
  const canRequestEdits = eventType === 'host' && lifecycle === EVENT_LIFECYCLE.SUBMITTED;

  // Edit Rules:
  // Venue can edit its own draft events only.
  // Host can edit their own draft or needs_changes events.
  // Neither can edit across roles (venue cannot touch host content and vice-versa).
  const canEdit =
    (eventType === 'venue' && lifecycle === EVENT_LIFECYCLE.DRAFT) ||
    (eventType === 'host' &&
      (lifecycle === EVENT_LIFECYCLE.DRAFT || lifecycle === EVENT_LIFECYCLE.NEEDS_CHANGES));

  return {
    ...data,
    id: eventId,
    poster,
    image: poster, // Maintain legacy compat
    posterUrl: poster, // Admin Console compatibility
    cityKey,
    cityLabel: getCityLabel(cityKey),
    lifecycle,
    eventType,
    canApprove,
    canEdit,
    canRequestEdits,
    settings,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
    // Visibility flag helper for easy template logic
    isPublic: PUBLIC_LIFECYCLE_STATES.includes(lifecycle),
  };
}

/**
 * Resolves Host and Venue snapshots from a payload containing IDs.
 * Used for server-side normalization of partner metadata.
 */
export async function resolvePartnerSnapshots(db, payload = {}) {
  const normalizedRole = payload.creatorRole === 'club' ? 'venue' : payload.creatorRole;
  const hostDocId = payload.hostId || (normalizedRole === 'host' ? payload.creatorId : null);
  const venueDocId = payload.venueId || (normalizedRole === 'venue' ? payload.creatorId : null);

  const [hostDoc, venueDoc] = await Promise.all([
    hostDocId
      ? db
          .collection('hosts')
          .doc(hostDocId)
          .get()
          .catch(() => null)
      : Promise.resolve(null),
    venueDocId
      ? db
          .collection('venues')
          .doc(venueDocId)
          .get()
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  return {
    hostData: buildPartnerSnapshot(hostDoc, 'host', payload.host || payload.hostName),
    venueData: buildPartnerSnapshot(venueDoc, 'venue', payload.venueName || payload.venue),
  };
}
