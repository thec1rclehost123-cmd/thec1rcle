export interface Event {
    id: string;
    workspaceId: string;
    title: string;
    cityKey: string;
    lifecycle: string;
    startDate: string;
    venueId: string;
    creatorId: string;
    [key: string]: any;
}
export interface IEventRepository {
    getById(id: string, workspaceId: string): Promise<Event | null>;
    getBySlug(slug: string, workspaceId: string): Promise<Event | null>;
    list(filters: any, workspaceId: string): Promise<Event[]>;
    create(event: Event): Promise<void>;
    update(id: string, updates: Partial<Event>, workspaceId: string): Promise<void>;
    updateLifecycle(id: string, status: string, actorId: string, workspaceId: string): Promise<void>;
    listNearby(lat: number, lng: number, radius: number): Promise<Event[]>;
}
