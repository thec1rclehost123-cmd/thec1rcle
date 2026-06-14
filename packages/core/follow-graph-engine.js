import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb, isFirebaseConfigured } from './admin.js';

const FOLLOWS_COLLECTION = 'follows';

const fallbackFollows = [];

export async function followEntity(followerId, targetId, targetType) {
    const id = `${followerId}_${targetId}`;
    const now = new Date().toISOString();

    const follow = { id, followerId, targetId, targetType, createdAt: now };

    if (!isFirebaseConfigured()) {
        const existing = fallbackFollows.find(f => f.id === id);
        if (!existing) fallbackFollows.push(follow);
        return follow;
    }

    const db = getAdminDb();
    await db.collection(FOLLOWS_COLLECTION).doc(id).set(follow, { merge: true });

    const targetCollection = targetType === 'venue' ? 'venues' : 'hosts';
    try {
        await db.collection(targetCollection).doc(targetId).update({
            followersCount: FieldValue.increment(1),
        });
    } catch {
        // non-fatal: follower count denormalization
    }

    return follow;
}

export async function unfollowEntity(followerId, targetId, targetType) {
    const id = `${followerId}_${targetId}`;

    if (!isFirebaseConfigured()) {
        const index = fallbackFollows.findIndex(f => f.id === id);
        if (index >= 0) fallbackFollows.splice(index, 1);
        return { unfollowed: true };
    }

    const db = getAdminDb();
    await db.collection(FOLLOWS_COLLECTION).doc(id).delete();

    const targetCollection = targetType === 'venue' ? 'venues' : 'hosts';
    try {
        await db.collection(targetCollection).doc(targetId).update({
            followersCount: FieldValue.increment(-1),
        });
    } catch {
        // non-fatal: follower count denormalization
    }

    return { unfollowed: true };
}

export async function isFollowing(followerId, targetId) {
    const id = `${followerId}_${targetId}`;

    if (!isFirebaseConfigured()) {
        return fallbackFollows.some(f => f.id === id);
    }

    const db = getAdminDb();
    const doc = await db.collection(FOLLOWS_COLLECTION).doc(id).get();
    return doc.exists;
}

export async function getFollowers(targetId, targetType = 'venue') {
    if (!isFirebaseConfigured()) {
        return fallbackFollows
            .filter(f => f.targetId === targetId && f.targetType === targetType)
            .map(f => f.followerId);
    }

    const db = getAdminDb();
    const snapshot = await db.collection(FOLLOWS_COLLECTION)
        .where('targetId', '==', targetId)
        .where('targetType', '==', targetType)
        .get();

    return snapshot.docs.map(doc => doc.data().followerId);
}
