import { Firestore } from 'firebase-admin/firestore';
import { IProfileRepository, Profile } from '../../../domain/repositories/profile-repository.js';

export class FirebaseProfileRepository implements IProfileRepository {
  constructor(private db: Firestore) { }

  private getCollection(type: 'user' | 'venue' | 'host'): string {
    return type === 'venue' ? 'venues' : (type === 'host' ? 'hosts' : 'users');
  }

  async getById(id: string, type: 'user' | 'venue' | 'host'): Promise<Profile | null> {
    const doc = await this.db.collection(this.getCollection(type)).doc(id).get();
    if (!doc.exists) return null;
    return { uid: doc.id, ...doc.data() } as Profile;
  }

  async update(id: string, type: 'user' | 'venue' | 'host', updates: Partial<Profile>): Promise<void> {
    const collection = this.getCollection(type);
    await this.db.collection(collection).doc(id).update({
      ...updates,
      updatedAt: new Date().toISOString()
    });
  }

  async create(profile: Profile): Promise<void> {
    await this.db.collection('users').doc(profile.uid).set(profile, { merge: true });
  }

  async getPosts(id: string, type: string, limit: number): Promise<any[]> {
    const snapshot = await this.db.collection('profile_posts')
      .where("profileId", "==", id)
      .where("profileType", "==", type)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async getHighlights(id: string, type: string): Promise<any[]> {
    const snapshot = await this.db.collection('profile_highlights')
      .where("profileId", "==", id)
      .where("profileType", "==", type)
      .orderBy("createdAt", "desc")
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
}
