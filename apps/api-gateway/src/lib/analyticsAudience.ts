import type { Firestore } from 'firebase-admin/firestore';

const AUDIENCE_AGE_BANDS = ['18-21', '22-27', '28-35', '35-44', '45+'];
const PAID_STATUSES = new Set(['confirmed', 'paid']);

function toIso(value: any): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
}

function bucketAge(ageBands: Record<string, number>, age: number) {
  if (age <= 21) ageBands['18-21']++;
  else if (age <= 27) ageBands['22-27']++;
  else if (age <= 35) ageBands['28-35']++;
  else if (age <= 44) ageBands['35-44']++;
  else ageBands['45+']++;
}

function countGender(genderRatio: Record<string, number>, gender: string) {
  const g = String(gender || '').toLowerCase();
  if (g === 'male') genderRatio.male++;
  else if (g === 'female') genderRatio.female++;
  else genderRatio.other++;
}

function ageFromProfile(profile: any): number {
  const explicit = Number(profile?.age || 0);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const dob = profile?.dob || profile?.dateOfBirth;
  if (dob) {
    const birth = typeof dob?.toDate === 'function' ? dob.toDate() : new Date(dob);
    if (!Number.isNaN(birth.getTime())) {
      const diff = Date.now() - birth.getTime();
      return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
    }
  }
  return 0;
}

/**
 * Fetches recent order docs for a partner without requiring a composite index
 * on (partnerId, status, createdAt). Uses the indexed (partnerId, createdAt)
 * query first and falls back to a plain partnerId query if it fails.
 */
async function fetchPartnerOrders(
  db: Firestore,
  partnerId: string,
  field: 'venueId' | 'hostId' | 'eventId',
  limit: number,
): Promise<Array<Record<string, any>>> {
  const base = db.collection('orders');
  const ordered = await base
    .where(field, '==', partnerId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get()
    .catch(() => null);
  if (ordered) return (ordered.docs || []).map((doc) => doc.data() || {});
  const fallback = await base
    .where(field, '==', partnerId)
    .limit(limit)
    .get()
    .catch(() => ({ docs: [] as any[] }));
  return ((fallback as any).docs || []).map((doc: any) => doc.data() || {});
}

/**
 * Aggregates crowd demographics (gender split + age distribution) for a partner.
 * Orders do not carry gender/age, so demographics are resolved from the buyer's
 * `users` profile (keyed by order.userId) and from walk-ins captured in door_sales.
 * Returns the shape the analytics v2 normalizer expects.
 */
export async function aggregateAudience(
  db: Firestore,
  scope: { venueId?: string; hostId?: string; eventId?: string },
  fromIso: string,
) {
  const genderRatio = { female: 0, male: 0, other: 0 };
  const ageBands: Record<string, number> = Object.fromEntries(
    AUDIENCE_AGE_BANDS.map((band) => [band, 0]),
  );
  const buyerIds = new Set<string>();
  let partySizeSum = 0;
  let partySizeCount = 0;

  const field: 'venueId' | 'hostId' | 'eventId' = scope.eventId
    ? 'eventId'
    : scope.venueId
      ? 'venueId'
      : 'hostId';
  const partnerId = scope.eventId || scope.venueId || scope.hostId || '';

  const [allOrders, doorSnap] = await Promise.all([
    fetchPartnerOrders(db, partnerId, field, 2000),
    scope.eventId
      ? db
          .collection('door_sales')
          .where('eventId', '==', scope.eventId)
          .limit(2000)
          .get()
          .catch(() => ({ docs: [] as any[] }))
      : scope.venueId
        ? db
            .collection('door_sales')
            .where('venueId', '==', scope.venueId)
            .limit(2000)
            .get()
            .catch(() => ({ docs: [] as any[] }))
        : Promise.resolve({ docs: [] as any[] }),
  ]);

  // Filter status + window in memory (index-unsafe Firestore filters).
  const orders = allOrders.filter((d) => {
    if (!PAID_STATUSES.has(String(d.status || ''))) return false;
    const created = toIso(d.createdAt);
    return !created || created >= fromIso;
  });

  // Collect unique buyers so we can resolve demographics from user profiles.
  const userIds = new Set<string>();
  for (const d of orders) {
    const uid = d.userId;
    if (uid) userIds.add(uid);
  }

  // Resolve gender/age from the users profile (orders do not store demographics).
  const profileByUserId: Record<string, { gender?: string; age?: number }> = {};
  const userIdArr = Array.from(userIds);
  for (let i = 0; i < userIdArr.length; i += 30) {
    const chunk = userIdArr.slice(i, i + 30);
    const snap = await db
      .collection('users')
      .where('__name__', 'in', chunk)
      .get()
      .catch(() => ({ docs: [] as any[] }));
    for (const doc of (snap as any).docs || []) {
      const p = doc.data() || {};
      profileByUserId[doc.id] = { gender: p.gender, age: ageFromProfile(p) || undefined };
    }
  }

  for (const d of orders) {
    const profile = d.userId ? profileByUserId[d.userId] : null;
    countGender(genderRatio, d.buyerGender || d.gender || profile?.gender || '');
    const age = Number(d.buyerAge || d.age || profile?.age || 0);
    if (Number.isFinite(age) && age >= 18) bucketAge(ageBands, age);
    if (d.userId) buyerIds.add(d.userId);
    const party = Number(d.ticketCount || d.quantity || 1) || 1;
    partySizeSum += party;
    partySizeCount++;
  }

  for (const doc of (doorSnap as any).docs || []) {
    const d = doc.data() || {};
    if (String(d.category || 'walkin') === 'dinein') continue;
    const addedAt = toIso(d.addedAt || d.soldAt || d.createdAt);
    if (addedAt && addedAt < fromIso) continue;
    countGender(genderRatio, d.gender);
    const age = Number(d.age ?? d.guestAge ?? 0);
    if (Number.isFinite(age) && age >= 18) bucketAge(ageBands, age);
    const party = Number(d.totalGuests || d.partySize || 1) || 1;
    partySizeSum += party;
    partySizeCount++;
  }

  return {
    totalUniqueGuests: buyerIds.size,
    newGuests: 0,
    repeatGuests: 0,
    vipGuests: 0,
    genderRatio,
    ageBands,
    avgPartySize: partySizeCount > 0 ? partySizeSum / partySizeCount : 0,
    avgArrivalMinutes: 0,
    loyaltyDistribution: [],
  };
}
