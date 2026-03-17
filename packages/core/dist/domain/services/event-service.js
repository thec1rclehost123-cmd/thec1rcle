// @ts-ignore
import { buildEvent } from '../../../event-engine.js';
export class EventService {
    eventRepo;
    constructor(eventRepo) {
        this.eventRepo = eventRepo;
    }
    async getEventByIdOrSlug(id, workspaceId) {
        const event = await this.eventRepo.getById(id, workspaceId);
        if (event)
            return event;
        return this.eventRepo.getBySlug(id, workspaceId);
    }
    async listEvents(filters, workspaceId) {
        try {
            const { limit = 20 } = filters;
            // Fetch limit + 1 to determine if there's a next page
            const events = await this.eventRepo.list({ ...filters, limit: limit + 1 }, workspaceId);
            const hasMore = events.length > limit;
            const data = events.slice(0, limit);
            const nextCursor = hasMore ? data[data.length - 1].id : null;
            return { events: data, nextCursor, hasMore };
        }
        catch (error) {
            console.error('EventService.listEvents failed:', error.message);
            return { events: [], nextCursor: null, hasMore: false };
        }
    }
    async createEvent(payload, actorId, workspaceId) {
        const event = buildEvent({
            ...payload,
            creatorId: actorId,
            workspaceId // 🏢 SaaS: Tag event with workspace
        });
        await this.eventRepo.create(event);
        return event;
    }
    async updateEvent(id, updates, actorId, workspaceId) {
        const existing = await this.getEventByIdOrSlug(id, workspaceId);
        if (!existing)
            return null;
        const updatedEvent = buildEvent({ ...existing, ...updates, id, updatedAt: new Date().toISOString() });
        await this.eventRepo.update(id, updatedEvent, workspaceId);
        return updatedEvent;
    }
    async deleteEvent(id, actorId, workspaceId) {
        await this.eventRepo.updateLifecycle(id, 'deleted', actorId, workspaceId);
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
