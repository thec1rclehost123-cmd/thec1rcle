import { Interaction, IMatchingRepository } from '../../../domain/repositories/matching-repository.js';
import type { Firestore } from 'firebase-admin/firestore';

export class FirebaseMatchingRepository implements IMatchingRepository {
    constructor(private db: Firestore) { }

    async saveInteraction(interaction: Interaction): Promise<void> {
        await this.db.collection('interactions').add({
            ...interaction,
            createdAt: interaction.createdAt || new Date().toISOString()
        });
    }

    async getInteractedIds(userId: string, targetType: 'user' | 'event'): Promise<string[]> {
        const snapshot = await this.db.collection('interactions')
            .where('userId', '==', userId)
            .where('targetType', '==', targetType)
            .select('targetId')
            .get();

        return snapshot.docs.map(doc => doc.data().targetId);
    }

    async getInteractionHistory(userId: string, limit: number = 50): Promise<Interaction[]> {
        const snapshot = await this.db.collection('interactions')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as unknown as Interaction));
    }
}
