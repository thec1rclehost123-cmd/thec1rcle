import { IEventRepository, Event } from '../repositories/event-repository.js';
export declare class EventService {
    private eventRepo;
    constructor(eventRepo: IEventRepository);
    getEventByIdOrSlug(id: string, workspaceId: string): Promise<Event | null>;
    listEvents(filters: any, workspaceId: string): Promise<{
        events: Event[];
        nextCursor: string | null;
        hasMore: boolean;
    }>;
    createEvent(payload: any, actorId: string, workspaceId: string): Promise<Event>;
    updateEvent(id: string, updates: any, actorId: string, workspaceId: string): Promise<Event | null>;
    deleteEvent(id: string, actorId: string, workspaceId: string): Promise<void>;
    listNearby(lat: number, lng: number, radius: number, limit: number): Promise<any[]>;
}
