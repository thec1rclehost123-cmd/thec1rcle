/**
 * Next-event guest intelligence store
 * Venue Dashboard v2 — Feature 3
 *
 * Aggregates guestlist data for the next upcoming event at a venue,
 * segmented by booking type, gender, ticket category, etc.
 */

import { getAdminDb, isFirebaseConfigured } from '../firebase/admin';

export interface GuestSegment {
  count: number;
  label: string;
}

export interface NextEventIntelligence {
  eventId: string;
  eventName: string;
  eventDate: string; // ISO
  eventTime: string; // HH:mm IST
  coverImage: string | null;
  /** Total guests currently on list */
  totalGuests: number;
  /** Purchased ticket holders */
  booked: GuestSegment;
  /** Interested / RSVP (not purchased) */
  interested: GuestSegment;
  /** Tables booked */
  tables: GuestSegment;
  /** By gender */
  genders: { male: number; female: number; other: number };
  /** By ticket tier name */
  byTier: { tier: string; count: number }[];
  /** Couples category */
  couples: GuestSegment;
  /** Walk-in count so far today */
  walkInsToday: number;
  /** Check-in percentage */
  checkInRate: number;
  lastRefreshed: string; // ISO
}

export async function getNextEventIntelligence(
  venueId: string,
): Promise<NextEventIntelligence | null> {
  if (!isFirebaseConfigured()) {
    return getMockIntelligence();
  }

  const db = getAdminDb();
  const now = new Date().toISOString();

  // Find next upcoming event at this venue
  const eventSnap = await db
    .collection('events')
    .where('venueId', '==', venueId)
    .where('status', 'in', ['PUBLISHED', 'ACTIVE'])
    .where('startDate', '>=', now.slice(0, 10))
    .orderBy('startDate', 'asc')
    .limit(1)
    .get();

  if (eventSnap.empty) return null;

  const eventDoc = eventSnap.docs[0];
  const event = eventDoc.data();
  const eventId = eventDoc.id;

  // Load guestlist aggregate
  const guestSnap = await db.collection('guest_lists').doc(eventId).collection('guests').get();

  const guests = guestSnap.docs.map((d: any) => d.data());

  const booked = guests.filter((g: any) => g.bookingType === 'ticket' || g.source === 'ticket');
  const interested = guests.filter((g: any) => g.bookingType === 'rsvp' || g.source === 'rsvp');
  const tables = guests.filter((g: any) => g.bookingType === 'table' || g.guestType === 'table');
  const couples = guests.filter((g: any) => g.category === 'couple' || g.guestType === 'couple');

  // Gender breakdown from ticket metadata
  const genders = { male: 0, female: 0, other: 0 };
  for (const g of guests) {
    const gender = (g.gender ?? g.ticketGender ?? '').toLowerCase();
    if (gender === 'male' || gender === 'm') genders.male++;
    else if (gender === 'female' || gender === 'f') genders.female++;
    else genders.other++;
  }

  // By tier
  const tierMap = new Map<string, number>();
  for (const g of guests) {
    const tier = g.tierName ?? g.ticketTier ?? 'General';
    tierMap.set(tier, (tierMap.get(tier) ?? 0) + 1);
  }
  const byTier = Array.from(tierMap.entries())
    .map(([tier, count]) => ({ tier, count }))
    .sort((a, b) => b.count - a.count);

  // Walk-ins today
  const todayStr = now.slice(0, 10);
  const walkInSnap = await db
    .collection('walk_in_entries')
    .doc(eventId)
    .collection('logs')
    .where('addedAt', '>=', todayStr)
    .where('status', '==', 'active')
    .get();

  const walkInsToday = walkInSnap.size;

  // Check-in rate
  const checkedIn = guests.filter((g: any) => g.checkedIn === true).length;
  const checkInRate = booked.length > 0 ? Math.round((checkedIn / booked.length) * 100) : 0;

  return {
    eventId,
    eventName: event.title ?? event.name ?? 'Upcoming Event',
    eventDate: event.startDate,
    eventTime: event.startTime ?? '21:00',
    coverImage: event.coverImage ?? event.posterImage ?? null,
    totalGuests: guests.length,
    booked: { count: booked.length, label: 'Booked' },
    interested: { count: interested.length, label: 'Interested' },
    tables: { count: tables.length, label: 'Tables' },
    couples: { count: couples.length, label: 'Couples' },
    genders,
    byTier,
    walkInsToday,
    checkInRate,
    lastRefreshed: new Date().toISOString(),
  };
}

function getMockIntelligence(): NextEventIntelligence {
  return {
    eventId: 'mock-event-1',
    eventName: 'Saturday Night (Demo)',
    eventDate: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    eventTime: '21:00',
    coverImage: null,
    totalGuests: 142,
    booked: { count: 98, label: 'Booked' },
    interested: { count: 27, label: 'Interested' },
    tables: { count: 8, label: 'Tables' },
    couples: { count: 12, label: 'Couples' },
    genders: { male: 63, female: 71, other: 8 },
    byTier: [
      { tier: 'General', count: 56 },
      { tier: 'VIP', count: 28 },
      { tier: 'Table for 4', count: 14 },
    ],
    walkInsToday: 0,
    checkInRate: 0,
    lastRefreshed: new Date().toISOString(),
  };
}
