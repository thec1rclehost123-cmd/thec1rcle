import { IEventRepository, Event } from '../repositories/event-repository.js';
// @ts-ignore
import { buildEvent } from '../../../event-engine.js';

export class EventService {
    constructor(private eventRepo: IEventRepository) { }

    async getEventByIdOrSlug(id: string, workspaceId: string): Promise<Event | null> {
        const event = await this.eventRepo.getById(id, workspaceId);
        if (event) return event;
        return this.eventRepo.getBySlug(id, workspaceId);
    }

    async listEvents(filters: any, workspaceId: string): Promise<{ events: Event[], nextCursor: string | null, hasMore: boolean }> {
        try {
            const { limit = 20 } = filters;
            // Fetch limit + 1 to determine if there's a next page
            const events = await this.eventRepo.list({ ...filters, limit: limit + 1 }, workspaceId);

            const hasMore = events.length > limit;
            const data = events.slice(0, limit);
            const nextCursor = hasMore ? data[data.length - 1].id : null;

            return { events: data, nextCursor, hasMore };
        } catch (error: any) {
            console.error('EventService.listEvents failed:', error.message);
            return { events: [], nextCursor: null, hasMore: false };
        }
    }

    async createEvent(payload: any, actorId: string, workspaceId: string): Promise<Event> {
        const event = buildEvent({ 
            ...payload, 
            creatorId: actorId,
            workspaceId // 🏢 SaaS: Tag event with workspace
        });
        await this.eventRepo.create(event as Event);
        return event as Event;
    }

    async updateEvent(id: string, updates: any, actorId: string, workspaceId: string): Promise<Event | null> {
        const existing = await this.getEventByIdOrSlug(id, workspaceId);
        if (!existing) return null;

        const updatedEvent = buildEvent({ ...existing, ...updates, id, updatedAt: new Date().toISOString() });

        await this.eventRepo.update(id, updatedEvent as Partial<Event>, workspaceId);
        return updatedEvent as Event;
    }

    async deleteEvent(id: string, actorId: string, workspaceId: string): Promise<void> {
        await this.eventRepo.updateLifecycle(id, 'deleted', actorId, workspaceId);
    }

    async listNearby(lat: number, lng: number, radius: number, limit: number): Promise<any[]> {
        // Enforce limit at repository level
        const events = await this.eventRepo.listNearby(lat, lng, radius, limit);

        // Maintain Haversine parity for exact distance sorting
        const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
            const R = 6371;
            const dLat = (lat2 - lat1) * (Math.PI / 180);
            const dLon = (lon2 - lon1) * (Math.PI / 180);
            const a = Math.sin(dLat / 2) ** 2 +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) ** 2;
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };

        return events
            .map((data: any) => {
                const coords = data.coordinates;
                if (!coords?.latitude || !coords?.longitude) return null;
                const distance = haversine(lat, lng, coords.latitude, coords.longitude);
                return { ...data, distance };
            })
            .filter((e: any) => e !== null && e.distance <= radius)
            .sort((a: any, b: any) => a.distance - b.distance)
            .slice(0, limit);
    }
}
