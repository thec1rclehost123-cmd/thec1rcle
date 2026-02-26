export interface Event {
    id: string;
    title: string;
    cityKey: string;
    lifecycle: string;
    startDate: string;
    venueId: string;
    creatorId: string;
    [key: string]: any;
}
export interface IEventRepository {
    getById(id: string): Promise<Event | null>;
    getBySlug(slug: string): Promise<Event | null>;
    list(filters: any): Promise<Event[]>;
    create(event: Event): Promise<void>;
    update(id: string, updates: Partial<Event>): Promise<void>;
    updateLifecycle(id: string, status: string, actorId: string): Promise<void>;
    listNearby(lat: number, lng: number, radius: number): Promise<Event[]>;
}
