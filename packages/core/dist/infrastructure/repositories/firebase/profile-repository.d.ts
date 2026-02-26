import { Firestore } from 'firebase-admin/firestore';
import { IProfileRepository, Profile } from '../../../domain/repositories/profile-repository.js';
export declare class FirebaseProfileRepository implements IProfileRepository {
    private db;
    constructor(db: Firestore);
    private getCollection;
    getById(id: string, type: 'user' | 'venue' | 'host'): Promise<Profile | null>;
    update(id: string, type: 'user' | 'venue' | 'host', updates: Partial<Profile>): Promise<void>;
    create(profile: Profile): Promise<void>;
    getPosts(id: string, type: string, limit: number): Promise<any[]>;
    getHighlights(id: string, type: string): Promise<any[]>;
}
