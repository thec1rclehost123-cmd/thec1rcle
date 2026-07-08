/**
 * Public venue directory service.
 *
 * Backs the gateway routes:
 *   - GET /api/v1/venues
 *   - GET /api/v1/venues/:id
 *   - GET /api/v1/venues/:id/events
 *
 * The logic here was ported from the previous inline Firestore handlers in
 * apps/api-gateway/src/routes/v1/venues.ts so the public directory keeps the
 * old behaviour (ID-or-slug lookup, rich detail fan-out, upcoming-events
 * filtering) while living in packages/core behind the { success, data }
 * contract the mobile app consumes.
 */

const MAX_VENUES = 200;
const MAX_GALLERY = 50;
const MAX_GALLERY_RETURNED = 9;
const MAX_UPCOMING_EVENTS = 50;

type AnyDoc = { id: string; data: () => any };
type EmptySnap = { docs: AnyDoc[] };

function mapDocs(snap: { docs: AnyDoc[] }): any[] {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function byOrderAsc(a: any, b: any): number {
  return Number(a.order || 0) - Number(b.order || 0);
}

/**
 * List venues for the public directory, optionally filtered by city.
 *
 * Ordering is computed in memory (heatScore desc) so a city filter never
 * requires a Firestore composite index.
 */
export async function getAllVenues(db: any, cityFilter?: string | null): Promise<any[]> {
  if (!db) throw new Error('Missing Firestore instance');

  let query: any = db.collection('venues');
  if (cityFilter) {
    query = query.where('city', '==', cityFilter);
  }

  const snapshot = await query.limit(MAX_VENUES).get();
  const venues = mapDocs(snapshot);

  venues.sort((a, b) => Number(b.heatScore || 0) - Number(a.heatScore || 0));
  return venues;
}

/**
 * Fetch a single venue by document ID or slug, enriched with its highlights,
 * gallery, menu, facilities, and upcoming events.
 *
 * Throws an Error whose message contains "not found" when the venue does not
 * exist so the gateway route can map it to a 404.
 */
export async function getVenueById(db: any, venueId: string): Promise<any> {
  if (!db) throw new Error('Missing Firestore instance');
  if (!venueId) throw new Error('Missing venueId');

  let venue: any = null;
  let resolvedId = venueId;

  // Resolve by document ID first, then fall back to slug.
  const docSnap = await db.collection('venues').doc(venueId).get();
  if (docSnap.exists) {
    venue = { id: docSnap.id, ...docSnap.data() };
  } else {
    const slugSnap = await db.collection('venues').where('slug', '==', venueId).limit(1).get();

    if (!slugSnap.empty) {
      const d = slugSnap.docs[0];
      venue = { id: d.id, ...d.data() };
      resolvedId = d.id;
    }
  }

  if (!venue) {
    throw Object.assign(new Error('Venue not found'), { code: 'NOT_FOUND' });
  }

  const empty = (): EmptySnap => ({ docs: [] });
  const now = new Date().toISOString();

  const [highlightsSnap, gallerySnap, menuSnap, facilitiesSnap, eventsSnap] = await Promise.all([
    db
      .collection('venue_highlights')
      .where('venueId', '==', resolvedId)
      .where('isActive', '==', true)
      .get()
      .catch(empty),
    db
      .collection('venue_gallery')
      .where('venueId', '==', resolvedId)
      .limit(MAX_GALLERY)
      .get()
      .catch(empty),
    db.collection('venue_menu').where('venueId', '==', resolvedId).get().catch(empty),
    db
      .collection('venue_facilities')
      .where('venueId', '==', resolvedId)
      .where('isEnabled', '==', true)
      .get()
      .catch(empty),
    db.collection('events').where('venueId', '==', resolvedId).get().catch(empty),
  ]);

  const highlights = mapDocs(highlightsSnap).sort(byOrderAsc);
  const gallery = mapDocs(gallerySnap).sort(byOrderAsc);
  const menu = mapDocs(menuSnap).sort(byOrderAsc);
  const facilities = mapDocs(facilitiesSnap).sort(byOrderAsc);

  const upcomingEvents = mapDocs(eventsSnap)
    .filter((e: any) => e.startDate >= now)
    .sort((a: any, b: any) => String(a.startDate).localeCompare(String(b.startDate)))
    .slice(0, 10);

  return {
    ...venue,
    highlights,
    gallery: gallery.slice(0, MAX_GALLERY_RETURNED),
    menu,
    facilities,
    upcomingEvents,
  };
}

/**
 * Return upcoming events for a venue, ordered by start date ascending.
 */
export async function getVenueEvents(db: any, venueId: string): Promise<any[]> {
  if (!db) throw new Error('Missing Firestore instance');
  if (!venueId) throw new Error('Missing venueId');

  const now = new Date().toISOString();
  const snap = await db
    .collection('events')
    .where('venueId', '==', venueId)
    .get()
    .catch((): EmptySnap => ({ docs: [] }));

  return mapDocs(snap)
    .filter((e: any) => e.startDate >= now)
    .sort((a: any, b: any) => String(a.startDate).localeCompare(String(b.startDate)))
    .slice(0, MAX_UPCOMING_EVENTS);
}
