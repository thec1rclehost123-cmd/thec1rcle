export class EventService {
    eventRepo;
    constructor(eventRepo) {
        this.eventRepo = eventRepo;
    }
    async getEventByIdOrSlug(id) {
        const event = await this.eventRepo.getById(id);
        if (event)
            return event;
        return this.eventRepo.getBySlug(id);
    }
    async listEvents(filters) {
        const { limit = 20 } = filters;
        const events = await this.eventRepo.list({ ...filters, limit: limit + 1 });
        const hasMore = events.length > limit;
        const data = events.slice(0, limit);
        return { events: data, hasMore };
    }
    async createEvent(payload, actorId) {
        // @ts-ignore
        const { buildEvent } = await import('@c1rcle/core/event-engine');
        const event = buildEvent({ ...payload, creatorId: actorId });
        await this.eventRepo.create(event);
        return event;
    }
    async updateEvent(id, updates, actorId) {
        const existing = await this.eventRepo.getById(id);
        if (!existing)
            return null;
        // @ts-ignore
        const { buildEvent } = await import('@c1rcle/core/event-engine');
        const updatedEvent = buildEvent({ ...existing, ...updates, id, updatedAt: new Date().toISOString() });
        await this.eventRepo.update(id, updatedEvent);
        return updatedEvent;
    }
    async deleteEvent(id, actorId) {
        await this.eventRepo.updateLifecycle(id, 'deleted', actorId);
    }
    async listNearby(lat, lng, radius, limit) {
        const events = await this.eventRepo.listNearby(lat, lng, radius);
        // Maintain Haversine parity
        const haversine = (lat1, lon1, lat2, lon2) => {
            const R = 6371;
            const dLat = (lat2 - lat1) * (Math.PI / 180);
            const dLon = (lon2 - lon1) * (Math.PI / 180);
            const a = Math.sin(dLat / 2) ** 2 +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                    Math.sin(dLon / 2) ** 2;
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };
        return events
            .map((data) => {
            const coords = data.coordinates;
            if (!coords?.latitude || !coords?.longitude)
                return null;
            const distance = haversine(lat, lng, coords.latitude, coords.longitude);
            return { ...data, distance };
        })
            .filter((e) => e !== null && e.distance <= radius)
            .sort((a, b) => a.distance - b.distance)
            .slice(0, limit);
    }
}
