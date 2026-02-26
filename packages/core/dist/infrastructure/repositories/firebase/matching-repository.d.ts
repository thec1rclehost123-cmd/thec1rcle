import { Interaction, IMatchingRepository } from '../../../domain/repositories/matching-repository.js';
import type { Firestore } from 'firebase-admin/firestore';
export declare class FirebaseMatchingRepository implements IMatchingRepository {
    private db;
    constructor(db: Firestore);
    saveInteraction(interaction: Interaction): Promise<void>;
    getInteractedIds(userId: string, targetType: 'user' | 'event'): Promise<string[]>;
    getInteractionHistory(userId: string, limit?: number): Promise<Interaction[]>;
}
