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

    async create(event: Event): Promise<void> {
        await this.db.collection('events').doc(event.id).set(event);
    }

    async update(id: string, updates: Partial<Event>): Promise<void> {
        await this.db.collection('events').doc(id).update({
            ...updates,
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
