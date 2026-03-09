import { Firestore } from 'firebase-admin/firestore';
import { IEventRepository, Event } from '../../../domain/repositories/event-repository.js';
export declare class FirebaseEventRepository implements IEventRepository {
    private db;
    constructor(db: Firestore);
    getById(id: string): Promise<Event | null>;
    getBySlug(slug: string): Promise<Event | null>;
    list(filters: any): Promise<Event[]>;
    /**
     * Q1 Denormalization: Embed host and venue snapshots at write time so
     * event detail pages can skip separate host/venue Firestore reads.
     * Falls back silently if profiles are not found.
     */
    private embedHostVenueData;
    create(event: Event): Promise<void>;
    update(id: string, updates: Partial<Event>): Promise<void>;
    updateLifecycle(id: string, status: string, actorId: string): Promise<void>;
    listNearby(lat: number, lng: number, radius: number): Promise<Event[]>;
}
