export class FirebaseProfileRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    getCollection(type) {
        return type === 'venue' ? 'venues' : (type === 'host' ? 'hosts' : 'users');
    }
    async getById(id, type) {
        const doc = await this.db.collection(this.getCollection(type)).doc(id).get();
        if (!doc.exists)
            return null;
        return { uid: doc.id, ...doc.data() };
    }
    async update(id, type, updates) {
        const collection = this.getCollection(type);
        await this.db.collection(collection).doc(id).update({
            ...updates,
            updatedAt: new Date().toISOString()
        });
    }
    async create(profile) {
        await this.db.collection('users').doc(profile.uid).set(profile, { merge: true });
    }
    async getPosts(id, type, limit) {
        const snapshot = await this.db.collection('profile_posts')
            .where("profileId", "==", id)
            .where("profileType", "==", type)
            .orderBy("createdAt", "desc")
            .limit(limit)
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    async getHighlights(id, type) {
        const snapshot = await this.db.collection('profile_highlights')
            .where("profileId", "==", id)
            .where("profileType", "==", type)
            .orderBy("createdAt", "desc")
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
}
