import { IEventRepository, Event } from '../repositories/event-repository.js';
export declare class EventService {
    private eventRepo;
    constructor(eventRepo: IEventRepository);
    getEventByIdOrSlug(id: string): Promise<Event | null>;
    listEvents(filters: any): Promise<{
        events: Event[];
        hasMore: boolean;
    }>;
    createEvent(payload: any, actorId: string): Promise<Event>;
    updateEvent(id: string, updates: any, actorId: string): Promise<Event | null>;
    deleteEvent(id: string, actorId: string): Promise<void>;
    listNearby(lat: number, lng: number, radius: number, limit: number): Promise<any[]>;
}
