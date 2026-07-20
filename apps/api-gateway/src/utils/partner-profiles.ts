import { signStorageUrl } from '../lib/signed-urls.js';

export type PartnerEntityType = 'venue' | 'host' | 'promoter';

function toIso(value: any): string | null {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

function toDate(value: any): Date | null {
  const iso = toIso(value);
  return iso ? new Date(iso) : null;
}

function compactLocation(city: string, area: string) {
  return [city, area].filter(Boolean).join(', ');
}

function pickString(...values: any[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function pickNumber(...values: any[]) {
  for (const value of values) {
    const numericValue = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(numericValue)) return numericValue;
  }
  return 0;
}

function cleanLinkValue(value: any) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeSocialLinks(...sources: any[]) {
  const entries: Record<string, string> = {};
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const [key, value] of Object.entries(source)) {
      const normalizedValue = cleanLinkValue(value);
      if (!normalizedValue) continue;
      entries[key] = normalizedValue;
    }
  }
  return entries;
}

function normalizeEvent(doc: Record<string, any>) {
  const startDate = toDate(doc.startDate || doc.date || doc.eventDate);
  return {
    id: String(doc.id || ''),
    title: pickString(doc.title, doc.eventName, doc.name, 'Untitled Event'),
    dateIso: startDate ? startDate.toISOString() : null,
    dateLabel: startDate
      ? startDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : 'Date TBA',
    imageUrl: pickString(doc.image, doc.coverImage, doc.poster, doc.bannerImage, doc.heroImage),
    venueName: pickString(doc.venueName, doc.venue, doc.locationName),
    city: pickString(doc.city, doc.cityName),
    lifecycle: pickString(doc.lifecycle, doc.status, 'scheduled'),
  };
}

function parseOnboardingEvents(value: any, lifecycle: string) {
  const entries = Array.isArray(value) ? value : typeof value === 'string' ? value.split('\n') : [];

  return entries
    .map((entry: any, index: number) => {
      if (!entry) return null;

      if (typeof entry === 'object' && !Array.isArray(entry)) {
        const title = pickString(entry.title, entry.name);
        if (!title) return null;

        const date = toDate(entry.dateIso || entry.date || entry.startDate);
        return {
          id: `onboarding-${lifecycle}-${index}`,
          title,
          dateIso: date ? date.toISOString() : null,
          dateLabel: date
            ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : lifecycle === 'completed'
              ? 'Completed event'
              : 'Upcoming event',
          imageUrl: '',
          venueName: pickString(entry.venueName, entry.venue),
          city: pickString(entry.city),
          lifecycle,
        };
      }

      const line = String(entry).trim();
      if (!line) return null;

      const [rawTitle, rawDate, rawVenue, rawCity] = line.split('|').map((part) => part.trim());
      const title = pickString(rawTitle);
      if (!title) return null;

      const parsedDate = rawDate ? new Date(rawDate) : null;
      const validDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;

      return {
        id: `onboarding-${lifecycle}-${index}`,
        title,
        dateIso: validDate ? validDate.toISOString() : null,
        dateLabel: validDate
          ? validDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : lifecycle === 'completed'
            ? 'Completed event'
            : 'Upcoming event',
        imageUrl: '',
        venueName: pickString(rawVenue),
        city: pickString(rawCity),
        lifecycle,
      };
    })
    .filter(Boolean);
}

async function getLatestOnboarding(db: any, uid: string) {
  if (!uid) return null;

  const snapshot = await db
    .collection('onboarding_requests')
    .where('uid', '==', uid)
    .limit(10)
    .get()
    .catch(() => null);

  if (!snapshot || snapshot.empty) return null;

  const sorted = snapshot.docs
    .map((doc: any) => ({ id: doc.id, ...doc.data() }))
    .sort((left: any, right: any) => {
      const leftTime = toDate(left.updatedAt || left.submittedAt)?.getTime() || 0;
      const rightTime = toDate(right.updatedAt || right.submittedAt)?.getTime() || 0;
      return rightTime - leftTime;
    });

  return sorted[0];
}

async function fetchEventsForPartner(db: any, partnerId: string, partnerType: PartnerEntityType) {
  if (partnerType === 'promoter') {
    const assignmentsSnap = await db
      .collection('promoter_assignments')
      .where('promoterId', '==', partnerId)
      .limit(100)
      .get()
      .catch(() => null);

    if (!assignmentsSnap || assignmentsSnap.empty) return [];
    const eventIds = Array.from(
      new Set(assignmentsSnap.docs.map((doc: any) => doc.data()?.eventId).filter(Boolean)),
    );
    if (eventIds.length === 0) return [];

    const eventDocs = await Promise.all(
      eventIds.map(async (eventId) => {
        const snapshot = await db
          .collection('events')
          .doc(String(eventId))
          .get()
          .catch(() => null);
        if (snapshot && snapshot.exists) {
          return { id: snapshot.id, ...snapshot.data() };
        }
        return null;
      }),
    );

    return eventDocs.filter(Boolean) as Record<string, any>[];
  }

  const field = partnerType === 'venue' ? 'venueId' : 'hostId';
  const snapshot = await db
    .collection('events')
    .where(field, '==', partnerId)
    .limit(100)
    .get()
    .catch(() => null);
  if (!snapshot || snapshot.empty) return [];
  return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
}

export async function resolvePartnerDocument(db: any, id: string) {
  if (!id) return null;

  // 1. Direct lookup
  const [venueDoc, hostDoc, promoterDoc] = await Promise.all([
    db
      .collection('venues')
      .doc(id)
      .get()
      .catch(() => null),
    db
      .collection('hosts')
      .doc(id)
      .get()
      .catch(() => null),
    db
      .collection('promoters')
      .doc(id)
      .get()
      .catch(() => null),
  ]);

  if (venueDoc?.exists) return { id: venueDoc.id, type: 'venue' as const, doc: venueDoc.data() };
  if (hostDoc?.exists) return { id: hostDoc.id, type: 'host' as const, doc: hostDoc.data() };
  if (promoterDoc?.exists)
    return { id: promoterDoc.id, type: 'promoter' as const, doc: promoterDoc.data() };

  // 2. Resolve via user collection
  const userDoc = await db
    .collection('users')
    .doc(id)
    .get()
    .catch(() => null);
  if (userDoc?.exists) {
    const userData = userDoc.data() || {};
    const targetId = userData.partnerId || userData.venueId || userData.promoterId;
    if (targetId) {
      const [vDoc, hDoc, pDoc] = await Promise.all([
        db
          .collection('venues')
          .doc(targetId)
          .get()
          .catch(() => null),
        db
          .collection('hosts')
          .doc(targetId)
          .get()
          .catch(() => null),
        db
          .collection('promoters')
          .doc(targetId)
          .get()
          .catch(() => null),
      ]);
      if (vDoc?.exists) return { id: vDoc.id, type: 'venue' as const, doc: vDoc.data() };
      if (hDoc?.exists) return { id: hDoc.id, type: 'host' as const, doc: hDoc.data() };
      if (pDoc?.exists) return { id: pDoc.id, type: 'promoter' as const, doc: pDoc.data() };
    }
  }

  // 3. Resolve by query
  const fallbackQueries = [
    { collection: 'venues', field: 'ownerId', type: 'venue' as const },
    { collection: 'venues', field: 'uid', type: 'venue' as const },
    { collection: 'hosts', field: 'uid', type: 'host' as const },
    { collection: 'hosts', field: 'userId', type: 'host' as const },
    { collection: 'promoters', field: 'uid', type: 'promoter' as const },
    { collection: 'promoters', field: 'userId', type: 'promoter' as const },
  ];

  for (const q of fallbackQueries) {
    const snapshot = await db
      .collection(q.collection)
      .where(q.field, '==', id)
      .limit(1)
      .get()
      .catch(() => null);
    if (snapshot && !snapshot.empty) {
      const doc = snapshot.docs[0];
      return { id: doc.id, type: q.type, doc: doc.data() };
    }
  }

  // 4. Resolve via partner_memberships mapping to user profile fallback
  const membershipSnap = await db
    .collection('partner_memberships')
    .where('partnerId', '==', id)
    .limit(1)
    .get()
    .catch(() => null);
  if (membershipSnap && !membershipSnap.empty) {
    const mData = membershipSnap.docs[0].data();
    const uid = mData.uid;
    if (uid) {
      const userDoc = await db
        .collection('users')
        .doc(uid)
        .get()
        .catch(() => null);
      if (userDoc?.exists) {
        return {
          id,
          type: (mData.partnerType || 'host') as PartnerEntityType,
          doc: userDoc.data(),
        };
      }
    }
  }

  return null;
}

export async function getPartnerProfileSummary(db: any, id: string, includePii: boolean = false) {
  let resolved = await resolvePartnerDocument(db, id);
  let isUserFallback = false;
  let userData: Record<string, any> = {};

  if (!resolved) {
    const userDoc = await db
      .collection('users')
      .doc(id)
      .get()
      .catch(() => null);
    if (userDoc?.exists) {
      userData = userDoc.data() || {};
      resolved = {
        id: userDoc.id,
        type: (userData.role || 'host') as PartnerEntityType,
        doc: userData,
      };
      isUserFallback = true;
    } else {
      return null;
    }
  }

  const { type, doc } = resolved;
  const ownerUid = pickString(doc.uid, doc.userId, doc.ownerId, resolved.id);

  const [userSnap, onboarding, eventDocs] = await Promise.all([
    isUserFallback
      ? Promise.resolve({ exists: true, data: () => userData })
      : ownerUid
        ? db
            .collection('users')
            .doc(ownerUid)
            .get()
            .catch(() => null)
        : Promise.resolve(null),
    getLatestOnboarding(db, ownerUid),
    fetchEventsForPartner(db, resolved.id, type),
  ]);

  const resolvedUserData = userSnap?.exists ? userSnap.data() || {} : {};
  const onboardingData = (onboarding?.data || onboarding || {}) as Record<string, any>;

  const resolvedEmail = includePii
    ? pickString(
        doc.email,
        doc.supportEmail,
        doc.contactEmail,
        doc.promoterEmail,
        resolvedUserData.email,
        onboardingData.email,
      ) || null
    : null;

  const resolvedPhone = includePii
    ? pickString(
        doc.phone,
        doc.contactPhone,
        doc.legalPhone,
        doc.phoneNumber,
        onboardingData.phone,
        resolvedUserData.phoneNumber,
      ) || null
    : null;

  const socialLinks = normalizeSocialLinks(onboardingData.socialLinks, doc.socialLinks, {
    instagram: pickString(doc.instagram, doc.instagramHandle, onboardingData.instagram),
    x: pickString(doc.x, doc.twitter, doc.twitterHandle, onboardingData.twitter),
    website: pickString(doc.website, onboardingData.website),
    spotify: pickString(doc.spotify, onboardingData.spotify),
    phone: includePii ? resolvedPhone || '' : '',
    email: includePii ? resolvedEmail || '' : '',
  });

  const normalizedEvents = eventDocs
    .map(normalizeEvent)
    .filter(
      (event: any) =>
        event.id && event.title && ['scheduled', 'live', 'completed'].includes(event.lifecycle),
    )
    .sort((left: any, right: any) => {
      const leftTime = left.dateIso ? new Date(left.dateIso).getTime() : 0;
      const rightTime = right.dateIso ? new Date(right.dateIso).getTime() : 0;
      return leftTime - rightTime;
    });

  const now = Date.now();
  const manualUpcomingEvents = parseOnboardingEvents(
    onboardingData.upcomingEventsText || onboardingData.upcomingEvents,
    'scheduled',
  );
  const manualPastEvents = parseOnboardingEvents(
    onboardingData.pastEventsText || onboardingData.pastEvents,
    'completed',
  );

  const liveUpcomingEvents = normalizedEvents
    .filter((event: any) => !event.dateIso || new Date(event.dateIso).getTime() >= now)
    .slice(0, 6);
  const livePastEvents = normalizedEvents
    .filter((event: any) => event.dateIso && new Date(event.dateIso).getTime() < now)
    .reverse()
    .slice(0, 8);

  const upcomingEvents = liveUpcomingEvents.length
    ? liveUpcomingEvents
    : manualUpcomingEvents.slice(0, 6);
  const pastEvents = livePastEvents.length ? livePastEvents : manualPastEvents.slice(0, 8);

  const createdAt = toDate(
    doc.createdAt || doc.submittedAt || resolvedUserData.createdAt || onboarding?.submittedAt,
  );
  const contactPoints = [
    resolvedEmail,
    resolvedPhone,
    pickString(doc.website, onboardingData.website),
    ...Object.values(socialLinks || {}),
  ].filter(Boolean).length;
  const totalEvents =
    normalizedEvents.length || manualUpcomingEvents.length + manualPastEvents.length;

  return {
    id: resolved.id,
    type,
    name: pickString(
      doc.displayName,
      doc.name,
      doc.brandName,
      doc.venueName,
      onboardingData.name,
      resolvedUserData.displayName,
      'Unknown Partner',
    ),
    legalName: pickString(
      doc.legalName,
      doc.name,
      onboardingData.contactPerson,
      onboardingData.name,
    ),
    bio: pickString(doc.bio, doc.description, doc.summary, onboardingData.bio),
    city: pickString(doc.city, onboardingData.city),
    area: pickString(doc.area, onboardingData.area),
    locationLabel: compactLocation(
      pickString(doc.city, onboardingData.city),
      pickString(doc.area, onboardingData.area),
    ),
    // SEC-8 fix: phone and email are PII — omitted from the public profile response.
    // Expose them only after verifying an active mutual connection at the call site.
    ...(includePii
      ? {
          _pii: {
            email: resolvedEmail,
            phone: resolvedPhone,
          },
        }
      : {}),
    avatarUrl: await signStorageUrl(
      pickString(
        doc.profileImage,
        doc.avatar,
        doc.avatarUrl,
        doc.photoURL,
        doc.photoUrl,
        doc.logoUrl,
        doc.logoImage,
        doc.logo,
      ),
    ),
    coverImageUrl: await signStorageUrl(pickString(doc.coverImage, doc.bannerImage, doc.heroImage)),
    website: pickString(doc.website, onboardingData.website),
    socialLinks,
    isVerified: Boolean(
      doc.isVerified ||
      doc.isApproved ||
      resolvedUserData.isApproved ||
      onboarding?.status === 'approved' ||
      onboarding?.status === 'verified' ||
      doc.status === 'active',
    ),
    memberSinceLabel: createdAt
      ? createdAt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : '',
    stats: {
      totalEvents: pickNumber(doc.eventsCount, totalEvents),
      upcomingEvents: upcomingEvents.length,
      pastEvents: pastEvents.length,
      contactPoints,
    },
    upcomingEvents,
    pastEvents,
  };
}

export async function getConnectionForViewer(
  db: any,
  params: {
    viewerRole?: string;
    viewerId?: string;
    partnerId: string;
    partnerType: PartnerEntityType;
  },
) {
  const { viewerRole, viewerId, partnerId, partnerType } = params;
  if (!viewerRole || !viewerId) return null;

  if (
    (viewerRole === 'venue' && partnerType === 'host') ||
    (viewerRole === 'host' && partnerType === 'venue')
  ) {
    const venueId = viewerRole === 'venue' ? viewerId : partnerId;
    const hostId = viewerRole === 'host' ? viewerId : partnerId;
    const snapshot = await db
      .collection('partnerships')
      .where('venueId', '==', venueId)
      .where('hostId', '==', hostId)
      .limit(1)
      .get()
      .catch(() => null);
    if (snapshot && !snapshot.empty) {
      const data = snapshot.docs[0].data();
      return {
        id: snapshot.docs[0].id,
        status: data.status || null,
        type: 'partnership',
        initiatedBy: data.initiatedBy || null,
      };
    }
  }

  const promoterId =
    viewerRole === 'promoter' ? viewerId : partnerType === 'promoter' ? partnerId : '';
  const otherId = viewerRole === 'promoter' ? partnerId : viewerId;
  const otherType = viewerRole === 'promoter' ? partnerType : viewerRole;

  if (promoterId && otherId) {
    let query = db.collection('promoter_connections').where('promoterId', '==', promoterId);

    if (otherType === 'venue') {
      query = query.where('venueId', '==', otherId);
    } else if (otherType === 'host') {
      query = query.where('hostId', '==', otherId);
    } else {
      query = query.where('targetId', '==', otherId);
    }

    const snapshot = await query
      .limit(1)
      .get()
      .catch(() => null);

    if (snapshot && !snapshot.empty) {
      const data = snapshot.docs[0].data();
      return {
        id: snapshot.docs[0].id,
        status: data.status || null,
        type: 'promoter_connection',
        initiatedBy: data.initiatedBy || null,
      };
    }
  }

  return null;
}

export async function getPartnerProfileWithPii(
  db: any,
  id: string,
  viewerRole: string,
  viewerId: string,
) {
  // Retrieve profile summary without PII by default
  const profile = await getPartnerProfileSummary(db, id, false);
  if (!profile) return null;

  // Resolve connection for the viewer
  const connection = await getConnectionForViewer(db, {
    viewerRole,
    viewerId,
    partnerId: id,
    partnerType: profile.type,
  });

  const isConnected =
    connection && (connection.status === 'active' || connection.status === 'approved');

  if (isConnected) {
    // If active mutual connection exists, fetch profile WITH PII
    const profileWithPii = await getPartnerProfileSummary(db, id, true);
    if (profileWithPii && (profileWithPii as any)._pii) {
      (profileWithPii as any).email = (profileWithPii as any)._pii.email;
      (profileWithPii as any).phone = (profileWithPii as any)._pii.phone;
      delete (profileWithPii as any)._pii;
    }
    return { profile: profileWithPii, connection };
  }

  return { profile, connection };
}
