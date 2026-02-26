export class FirebaseEventRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async getById(id) {
        const doc = await this.db.collection('events').doc(id).get();
        if (!doc.exists)
            return null;
        return { id: doc.id, ...doc.data() };
    }
    async getBySlug(slug) {
        const snapshot = await this.db.collection('events').where('slug', '==', slug).limit(1).get();
        if (snapshot.empty)
            return null;
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() };
    }
    async list(filters) {
        const { city, host, venueId, lifecycle, limit = 20, lastId, sort = 'soonest' } = filters;
        let q = this.db.collection('events');
        if (venueId)
            q = q.where('venueId', '==', venueId);
        if (lifecycle) {
            if (Array.isArray(lifecycle))
                q = q.where('lifecycle', 'in', lifecycle);
            else
                q = q.where('lifecycle', '==', lifecycle);
        }
        if (city)
            q = q.where('cityKey', '==', city);
        if (host)
            q = q.where('host', '==', host);
        if (lastId) {
            const lastDoc = await this.db.collection('events').doc(lastId).get();
            if (lastDoc.exists)
                q = q.startAfter(lastDoc);
        }
        if (sort === 'soonest')
            q = q.orderBy('startDate', 'asc');
        else if (sort === 'new')
            q = q.orderBy('createdAt', 'desc');
        else if (sort === 'heat')
            q = q.orderBy('heatScore', 'desc');
        q = q.limit(limit);
        const snapshot = await q.get();
        return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    }
    async create(event) {
        await this.db.collection('events').doc(event.id).set(event);
    }
    async update(id, updates) {
        await this.db.collection('events').doc(id).update({
            ...updates,
            updatedAt: new Date().toISOString()
        });
    }
    async updateLifecycle(id, status, actorId) {
        const now = new Date().toISOString();
        const updates = {
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
    async listNearby(lat, lng, radius) {
        // Current logic uses internal Haversine filtering on a broad dump which is inefficient 
        // but we'll maintain parity for now and just move it to repo.
        const nowIso = new Date().toISOString();
        const snapshot = await this.db.collection('events')
            .where('lifecycle', 'in', ['scheduled', 'live'])
            .where('endDate', '>=', nowIso)
            .get();
        return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    }
}
