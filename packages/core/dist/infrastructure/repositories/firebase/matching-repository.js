export class FirebaseMatchingRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async saveInteraction(interaction) {
        await this.db.collection('interactions').add({
            ...interaction,
            createdAt: interaction.createdAt || new Date().toISOString()
        });
    }
    async getInteractedIds(userId, targetType) {
        const snapshot = await this.db.collection('interactions')
            .where('userId', '==', userId)
            .where('targetType', '==', targetType)
            .select('targetId')
            .get();
        return snapshot.docs.map(doc => doc.data().targetId);
    }
    async getInteractionHistory(userId, limit = 50) {
        const snapshot = await this.db.collection('interactions')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    }
}
