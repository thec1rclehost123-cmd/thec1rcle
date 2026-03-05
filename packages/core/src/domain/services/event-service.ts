import { IEventRepository, Event } from '../repositories/event-repository.js';

export class EventService {
    constructor(private eventRepo: IEventRepository) { }

    async getEventByIdOrSlug(id: string): Promise<Event | null> {
        const event = await this.eventRepo.getById(id);
        if (event) return event;
        return this.eventRepo.getBySlug(id);
    }

    async listEvents(filters: any): Promise<{ events: Event[], hasMore: boolean }> {
        try {
            const { limit = 20 } = filters;
            const events = await this.eventRepo.list({ ...filters, limit: limit + 1 });

            const hasMore = events.length > limit;
            const data = events.slice(0, limit);

            return { events: data, hasMore };
        } catch (error: any) {
            console.error('EventService.listEvents failed:', error.message);
            return { events: [], hasMore: false };
        }
    }

    async createEvent(payload: any, actorId: string): Promise<Event> {
        // @ts-ignore
        const { buildEvent } = await import('@c1rcle/core/event-engine');
        const event = buildEvent({ ...payload, creatorId: actorId });
        await this.eventRepo.create(event as Event);
        return event as Event;
    }

    async updateEvent(id: string, updates: any, actorId: string): Promise<Event | null> {
        const existing = await this.eventRepo.getById(id);
        if (!existing) return null;

        // @ts-ignore
        const { buildEvent } = await import('@c1rcle/core/event-engine');
        const updatedEvent = buildEvent({ ...existing, ...updates, id, updatedAt: new Date().toISOString() });

        await this.eventRepo.update(id, updatedEvent as Partial<Event>);
        return updatedEvent as Event;
    }

    async deleteEvent(id: string, actorId: string): Promise<void> {
        await this.eventRepo.updateLifecycle(id, 'deleted', actorId);
    }

    async listNearby(lat: number, lng: number, radius: number, limit: number): Promise<any[]> {
        const events = await this.eventRepo.listNearby(lat, lng, radius);

        // Maintain Haversine parity
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
