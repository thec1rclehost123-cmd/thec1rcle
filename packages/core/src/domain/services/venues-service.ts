import { FieldValue } from 'firebase-admin/firestore';

type VenueFollowResult = {
  following: boolean;
  venueId: string;
  userId: string;
  followersCount?: number;
};

function normalizeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export async function followVenue(
  db: any,
  userId: string,
  venueId: string,
  metadata: { venueName?: string | null } = {},
): Promise<VenueFollowResult> {
  if (!db) throw new Error('Missing Firestore instance');
  if (!userId || !venueId) throw new Error('Missing userId or venueId');

  const venueRef = db.collection('venues').doc(venueId);
  const userFollowRef = db.collection('userFollows').doc(userId).collection('venues').doc(venueId);
  const venueFollowerRef = db
    .collection('venueFollowers')
    .doc(venueId)
    .collection('followers')
    .doc(userId);

  return db.runTransaction(async (tx: any) => {
    const [venueDoc, followDoc] = await Promise.all([tx.get(venueRef), tx.get(userFollowRef)]);
    if (!venueDoc.exists) throw Object.assign(new Error('Venue not found'), { code: 'NOT_FOUND' });

    const now = new Date().toISOString();
    const venueData = venueDoc.data() || {};
    const existingCount = normalizeCount(venueData.followersCount ?? venueData.followers);

    if (followDoc.exists) {
      tx.set(
        venueFollowerRef,
        {
          userId,
          venueId,
          followedAt: followDoc.data()?.followedAt || now,
          updatedAt: now,
        },
        { merge: true },
      );
      return { following: true, venueId, userId, followersCount: existingCount };
    }

    const userFollow = {
      venueId,
      venueName: metadata.venueName || venueData.displayName || venueData.name || null,
      followedAt: now,
      updatedAt: now,
    };
    const venueFollower = {
      userId,
      venueId,
      followedAt: now,
      updatedAt: now,
    };

    tx.set(userFollowRef, userFollow, { merge: true });
    tx.set(venueFollowerRef, venueFollower, { merge: true });
    tx.update(venueRef, {
      followersCount: FieldValue.increment(1),
      followers: FieldValue.increment(1),
      updatedAt: now,
    });

    return { following: true, venueId, userId, followersCount: existingCount + 1 };
  });
}

export async function unfollowVenue(
  db: any,
  userId: string,
  venueId: string,
): Promise<VenueFollowResult> {
  if (!db) throw new Error('Missing Firestore instance');
  if (!userId || !venueId) throw new Error('Missing userId or venueId');

  const venueRef = db.collection('venues').doc(venueId);
  const userFollowRef = db.collection('userFollows').doc(userId).collection('venues').doc(venueId);
  const venueFollowerRef = db
    .collection('venueFollowers')
    .doc(venueId)
    .collection('followers')
    .doc(userId);

  return db.runTransaction(async (tx: any) => {
    const [venueDoc, followDoc, followerDoc] = await Promise.all([
      tx.get(venueRef),
      tx.get(userFollowRef),
      tx.get(venueFollowerRef),
    ]);
    if (!venueDoc.exists) throw Object.assign(new Error('Venue not found'), { code: 'NOT_FOUND' });

    const now = new Date().toISOString();
    const venueData = venueDoc.data() || {};
    const existingCount = normalizeCount(venueData.followersCount ?? venueData.followers);
    const shouldDecrement = followDoc.exists || followerDoc.exists;
    const nextCount = shouldDecrement ? Math.max(0, existingCount - 1) : existingCount;

    if (followDoc.exists) tx.delete(userFollowRef);
    if (followerDoc.exists) tx.delete(venueFollowerRef);
    if (shouldDecrement) {
      tx.update(venueRef, {
        followersCount: nextCount,
        followers: nextCount,
        updatedAt: now,
      });
    }

    return { following: false, venueId, userId, followersCount: nextCount };
  });
}
