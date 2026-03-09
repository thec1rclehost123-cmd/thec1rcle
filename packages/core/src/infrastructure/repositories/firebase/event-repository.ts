import { Firestore } from 'firebase-admin/firestore';
import { IEventRepository, Event } from '../../../domain/repositories/event-repository.js';

export class FirebaseEventRepository implements IEventRepository {
    constructor(private db: Firestore) { }

    async getById(id: string): Promise<Event | null> {
        const doc = await this.db.collection('events').doc(id).get();
        if (!doc.exists) return null;
        return { id: doc.id, ...doc.data() } as Event;
    }

    async getBySlug(slug: string): Promise<Event | null> {
        const snapshot = await this.db.collection('events').where('slug', '==', slug).limit(1).get();
        if (snapshot.empty) return null;
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as Event;
    }

    async list(filters: any): Promise<Event[]> {
        const { city, host, venueId, lifecycle, limit = 20, lastId, sort = 'soonest' } = filters;
        let q: any = this.db.collection('events');

        if (venueId) q = q.where('venueId', '==', venueId);
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

        if (sort === 'soonest') q = q.orderBy('startDate', 'asc');
        else if (sort === 'new') q = q.orderBy('createdAt', 'desc');
        else if (sort === 'heat') q = q.orderBy('heatScore', 'desc');

        q = q.limit(limit);
        const snapshot = await q.get();
        return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
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
                    const q = await this.db.collection('hosts').where('handle', '==', normalized).limit(1).get();
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

        return enriched;
    }

    async create(event: Event): Promise<void> {
        const enriched = await this.embedHostVenueData(event);
        await this.db.collection('events').doc(event.id).set(enriched);
    }

    async update(id: string, updates: Partial<Event>): Promise<void> {
        const enriched = await this.embedHostVenueData(updates);
        await this.db.collection('events').doc(id).update({
            ...enriched,
            updatedAt: new Date().toISOString()
        });
    }

    async updateLifecycle(id: string, status: string, actorId: string): Promise<void> {
        const now = new Date().toISOString();
        const updates: any = {
            lifecycle: status,
            updatedAt: now
        };
        if (status === 'deleted') {
            updates.isDeleted = true;
            updates.deletedAt = now;
            updates.deletedBy = actorId;
        }
        await this.db.collection('events').doc(id).update(updates);
    }

    async listNearby(lat: number, lng: number, radius: number): Promise<Event[]> {
        // Current logic uses internal Haversine filtering on a broad dump which is inefficient 
        // but we'll maintain parity for now and just move it to repo.
        const nowIso = new Date().toISOString();
        const snapshot = await this.db.collection('events')
            .where('lifecycle', 'in', ['scheduled', 'live'])
            .where('endDate', '>=', nowIso)
            .get();

        return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    }
}
