import { Firestore, Transaction } from 'firebase-admin/firestore';
import { IEventRepository, Event } from '../../../domain/repositories/event-repository.js';
import { encodeGeohash, getGeohashRange, getNeighbors } from '../../utils/geohash.js';

function hasFiniteCoordinates(coords: any): coords is { latitude: number; longitude: number } {
  return Number.isFinite(Number(coords?.latitude)) && Number.isFinite(Number(coords?.longitude));
}

export class FirebaseEventRepository implements IEventRepository {
  constructor(private db: Firestore) {}

  async getById(id: string, workspaceId: string, transaction?: Transaction): Promise<Event | null> {
    const ref = this.db.collection('events').doc(id);
    const doc = transaction ? await transaction.get(ref) : await ref.get();
    if (!doc.exists) return null;
    const data = doc.data() as Event;

    // 🛡️ SaaS: Strict Partition Check
    if (workspaceId && data.workspaceId !== workspaceId) return null;

    const { id: _, ...dataWithoutId } = data;
    return { id: doc.id, ...dataWithoutId } as Event;
  }

  async getBySlug(slug: string, workspaceId: string): Promise<Event | null> {
    let q: any = this.db.collection('events').where('slug', '==', slug).limit(1);
    if (workspaceId) {
      q = q.where('workspaceId', '==', workspaceId); // 🏢 SaaS: Isolated Query
    }
    const snapshot = await q.get();

    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    const { id: _, ...dataWithoutId } = doc.data() as any;
    return { id: doc.id, ...dataWithoutId } as Event;
  }

  async list(filters: any, workspaceId?: string): Promise<Event[]> {
    const {
      city,
      host,
      venueId,
      category,
      lifecycle,
      limit = 20,
      lastId,
      sort = 'soonest',
    } = filters;
    let q: any = this.db.collection('events');

    // 🏢 SaaS: Only filter by workspace if a specific context is provided.
    // This allows Global/Public event discovery across all partners.
    if (workspaceId) {
      q = q.where('workspaceId', '==', workspaceId);
    }

    if (venueId) q = q.where('venueId', '==', venueId);
    if (category) q = q.where('category', '==', category);
    if (lifecycle) {
      if (Array.isArray(lifecycle)) q = q.where('lifecycle', 'in', lifecycle);
      else q = q.where('lifecycle', '==', lifecycle);
    }
    if (city) q = q.where('cityKey', '==', city);
    if (host) q = q.where('host', '==', host);

    if (lastId) {
      const lastDoc = await this.db.collection('events').doc(lastId).get();
      if (lastDoc.exists) q = q.startAfter(lastDoc);
    }

    if (sort === 'soonest') q = q.orderBy('startDate', 'asc').orderBy('__name__', 'asc');
    else if (sort === 'new') q = q.orderBy('createdAt', 'desc').orderBy('__name__', 'desc');
    else if (sort === 'heat') q = q.orderBy('heatScore', 'desc').orderBy('__name__', 'desc');

    q = q.limit(limit);
    const snapshot = await q.get();
    return snapshot.docs.map((doc: any) => {
      const { id: _, ...data } = doc.data();
      return { id: doc.id, ...data };
    });
  }

  /**
   * Q1 Denormalization: Embed host and venue snapshots at write time so
   * event detail pages can skip separate host/venue Firestore reads.
   * Falls back silently if profiles are not found.
   */
  private async embedHostVenueData(event: any): Promise<any> {
    const enriched = { ...event };

    // Embed host snapshot
    const hostId = event.hostId as string | undefined;
    const hostHandle = event.host as string | undefined;
    if (hostId || hostHandle) {
      try {
        let hostSnap: FirebaseFirestore.DocumentSnapshot | null = null;
        if (hostId) {
          hostSnap = await this.db.collection('hosts').doc(hostId).get();
        }
        if ((!hostSnap || !hostSnap.exists) && hostHandle) {
          const normalized = hostHandle.startsWith('@') ? hostHandle : `@${hostHandle}`;
          const q = await this.db
            .collection('hosts')
            .where('handle', '==', normalized)
            .limit(1)
            .get();
          if (!q.empty) hostSnap = q.docs[0];
        }
        if (hostSnap && hostSnap.exists) {
          const d = hostSnap.data() as any;
          enriched.hostData = {
            id: hostSnap.id,
            handle: d.handle || hostHandle || '',
            name: d.name || d.displayName || '',
            avatar: d.avatar || d.photoURL || '',
            slug: d.slug || hostSnap.id,
            type: 'host',
          };
        }
      } catch {
        // Non-fatal — legacy event detail path will handle the fallback read
      }
    }

    // Embed venue snapshot
    const venueId = event.venueId as string | undefined;
    const venueName = event.venue as string | undefined;
    if (venueId || venueName) {
      try {
        let venueSnap: FirebaseFirestore.DocumentSnapshot | null = null;
        if (venueId) {
          venueSnap = await this.db.collection('venues').doc(venueId).get();
        }
        if ((!venueSnap || !venueSnap.exists) && venueName) {
          const slug = venueName.toLowerCase().replace(/\s+/g, '-');
          const q = await this.db.collection('venues').where('slug', '==', slug).limit(1).get();
          if (!q.empty) venueSnap = q.docs[0];
        }
        if (venueSnap && venueSnap.exists) {
          const d = venueSnap.data() as any;
          enriched.venueData = {
            id: venueSnap.id,
            name: d.name || venueName || '',
            slug: d.slug || venueSnap.id,
            photoURL: d.photoURL || d.image || '',
            image: d.image || d.photoURL || '',
            area: d.area || '',
            type: 'venue',
          };
        }
      } catch {
        // Non-fatal — legacy event detail path will handle the fallback read
      }
    }

    // Embed geohash snapshot
    const coords = event.coordinates as any;
    if (hasFiniteCoordinates(coords)) {
      enriched.geohash = encodeGeohash(Number(coords.latitude), Number(coords.longitude), 9);
    }

    return enriched;
  }

  async create(event: Event): Promise<void> {
    const enriched = await this.embedHostVenueData(event);
    await this.db.collection('events').doc(event.id).set(enriched);
  }

  async update(id: string, updates: Partial<Event>, workspaceId: string): Promise<void> {
    // Verify ownership before update
    const existing = await this.getById(id, workspaceId);
    if (!existing) throw new Error('Forbidden: Event not found in this workspace');

    const enriched = await this.embedHostVenueData(updates);
    await this.db
      .collection('events')
      .doc(id)
      .update({
        ...enriched,
        updatedAt: new Date().toISOString(),
      });
  }

  async updateLifecycle(
    id: string,
    status: string,
    actorId: string,
    workspaceId: string,
  ): Promise<void> {
    // Verify ownership before update
    const existing = await this.getById(id, workspaceId);
    if (!existing) throw new Error('Forbidden: Event not found in this workspace');

    const now = new Date().toISOString();
    const updates: any = {
      lifecycle: status,
      updatedAt: now,
    };
    if (status === 'deleted') {
      updates.isDeleted = true;
      updates.deletedAt = now;
      updates.deletedBy = actorId;
    }
    await this.db.collection('events').doc(id).update(updates);
  }

  async listNearby(lat: number, lng: number, radius: number, limit: number = 20): Promise<Event[]> {
    const ranges = getNeighbors(lat, lng, radius);
    const nowIso = new Date().toISOString();

    // Optimized: Queries center + 8 neighbors in parallel
    const snapshots = await Promise.all(
      ranges.map(([start, end]) => {
        return this.db
          .collection('events')
          .where('geohash', '>=', start)
          .where('geohash', '<=', end)
          .where('lifecycle', 'in', ['scheduled', 'live'])
          .limit(limit) // 🛡️ Safe Guard: Apply limit at query level
          .get();
      }),
    );

    // Merge and deduplicate (different neighbors might overlap or cover same prefix)
    const eventMap = new Map<string, Event>();
    for (const snap of snapshots) {
      snap.docs.forEach((doc) => {
        const data = doc.data() as any;
        if (data.endDate >= nowIso) {
          eventMap.set(doc.id, { ...data, id: doc.id });
          if (eventMap.size >= limit) return; // Break early if limit reached
        }
      });
      if (eventMap.size >= limit) break;
    }

    return Array.from(eventMap.values()).slice(0, limit);
  }
}
