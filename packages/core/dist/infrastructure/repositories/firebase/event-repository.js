import { encodeGeohash, getNeighbors } from '../../utils/geohash.js';
export class FirebaseEventRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async getById(id, workspaceId) {
        const doc = await this.db.collection('events').doc(id).get();
        if (!doc.exists)
            return null;
        const data = doc.data();
        // 🛡️ SaaS: Strict Partition Check
        if (data.workspaceId !== workspaceId)
            return null;
        const { id: _, ...dataWithoutId } = data;
        return { id: doc.id, ...dataWithoutId };
    }
    async getBySlug(slug, workspaceId) {
        const snapshot = await this.db.collection('events')
            .where('workspaceId', '==', workspaceId) // 🏢 SaaS: Isolated Query
            .where('slug', '==', slug)
            .limit(1)
            .get();
        if (snapshot.empty)
            return null;
        const doc = snapshot.docs[0];
        const { id: _, ...dataWithoutId } = doc.data();
        return { id: doc.id, ...dataWithoutId };
    }
    async list(filters, workspaceId) {
        const { city, host, venueId, lifecycle, limit = 20, lastId, sort = 'soonest' } = filters;
        let q = this.db.collection('events').where('workspaceId', '==', workspaceId); // 🛡️ SaaS: Filter by Workspace
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
            q = q.orderBy('startDate', 'asc').orderBy('__name__', 'asc');
        else if (sort === 'new')
            q = q.orderBy('createdAt', 'desc').orderBy('__name__', 'desc');
        else if (sort === 'heat')
            q = q.orderBy('heatScore', 'desc').orderBy('__name__', 'desc');
        q = q.limit(limit);
        const snapshot = await q.get();
        return snapshot.docs.map((doc) => {
            const { id: _, ...data } = doc.data();
            return { id: doc.id, ...data };
        });
    }
    /**
     * Q1 Denormalization: Embed host and venue snapshots at write time so
     * event detail pages can skip separate host/venue Firestore reads.
     * Falls back silently if profiles are not found.
     */
    async embedHostVenueData(event) {
        const enriched = { ...event };
        // Embed host snapshot
        const hostId = event.hostId;
        const hostHandle = event.host;
        if (hostId || hostHandle) {
            try {
                let hostSnap = null;
                if (hostId) {
                    hostSnap = await this.db.collection('hosts').doc(hostId).get();
                }
                if ((!hostSnap || !hostSnap.exists) && hostHandle) {
                    const normalized = hostHandle.startsWith('@') ? hostHandle : `@${hostHandle}`;
                    const q = await this.db.collection('hosts').where('handle', '==', normalized).limit(1).get();
                    if (!q.empty)
                        hostSnap = q.docs[0];
                }
                if (hostSnap && hostSnap.exists) {
                    const d = hostSnap.data();
                    enriched.hostData = {
                        id: hostSnap.id,
                        handle: d.handle || hostHandle || '',
                        name: d.name || d.displayName || '',
                        avatar: d.avatar || d.photoURL || '',
                        slug: d.slug || hostSnap.id,
                        type: 'host',
                    };
                }
            }
            catch {
                // Non-fatal — legacy event detail path will handle the fallback read
            }
        }
        // Embed venue snapshot
        const venueId = event.venueId;
        const venueName = event.venue;
        if (venueId || venueName) {
            try {
                let venueSnap = null;
                if (venueId) {
                    venueSnap = await this.db.collection('venues').doc(venueId).get();
                }
                if ((!venueSnap || !venueSnap.exists) && venueName) {
                    const slug = venueName.toLowerCase().replace(/\s+/g, '-');
                    const q = await this.db.collection('venues').where('slug', '==', slug).limit(1).get();
                    if (!q.empty)
                        venueSnap = q.docs[0];
                }
                if (venueSnap && venueSnap.exists) {
                    const d = venueSnap.data();
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
            }
            catch {
                // Non-fatal — legacy event detail path will handle the fallback read
            }
        }
        // Embed geohash snapshot
        const coords = event.coordinates;
        if (coords?.latitude && coords?.longitude) {
            enriched.geohash = encodeGeohash(coords.latitude, coords.longitude, 9);
        }
        return enriched;
    }
    async create(event) {
        const enriched = await this.embedHostVenueData(event);
        await this.db.collection('events').doc(event.id).set(enriched);
    }
    async update(id, updates, workspaceId) {
        // Verify ownership before update
        const existing = await this.getById(id, workspaceId);
        if (!existing)
            throw new Error('Forbidden: Event not found in this workspace');
        const enriched = await this.embedHostVenueData(updates);
        await this.db.collection('events').doc(id).update({
            ...enriched,
            updatedAt: new Date().toISOString()
        });
    }
    async updateLifecycle(id, status, actorId, workspaceId) {
        // Verify ownership before update
        const existing = await this.getById(id, workspaceId);
        if (!existing)
            throw new Error('Forbidden: Event not found in this workspace');
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
    async listNearby(lat, lng, radius, limit = 20) {
        const ranges = getNeighbors(lat, lng, radius);
        const nowIso = new Date().toISOString();
        // Optimized: Queries center + 8 neighbors in parallel
        const snapshots = await Promise.all(ranges.map(([start, end]) => {
            return this.db.collection('events')
                .where('geohash', '>=', start)
                .where('geohash', '<=', end)
                .where('lifecycle', 'in', ['scheduled', 'live'])
                .limit(limit) // 🛡️ Safe Guard: Apply limit at query level
                .get();
        }));
        // Merge and deduplicate (different neighbors might overlap or cover same prefix)
        const eventMap = new Map();
        for (const snap of snapshots) {
            snap.docs.forEach(doc => {
                const data = doc.data();
                if (data.endDate >= nowIso) {
                    eventMap.set(doc.id, { ...data, id: doc.id });
                    if (eventMap.size >= limit)
                        return; // Break early if limit reached
                }
            });
            if (eventMap.size >= limit)
                break;
        }
        return Array.from(eventMap.values()).slice(0, limit);
    }
}
