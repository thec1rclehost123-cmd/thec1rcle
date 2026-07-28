const ENTITY_CONFIG = Object.freeze({
  venue: {
    targetCollection: 'venues',
    userSubcollection: 'venues',
    followerCollection: 'venueFollowers',
  },
  host: {
    targetCollection: 'hosts',
    userSubcollection: 'hosts',
    followerCollection: 'hostFollowers',
  },
});

function requireValue(value, field) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    const error = new Error(`${field} is required`);
    error.code = 'BAD_REQUEST';
    throw error;
  }
  return normalized;
}

function getEntityConfig(entityType) {
  const normalized = String(entityType || '')
    .trim()
    .toLowerCase();
  const config = ENTITY_CONFIG[normalized];
  if (!config) {
    const error = new Error('entityType must be venue or host');
    error.code = 'BAD_REQUEST';
    throw error;
  }
  return { entityType: normalized, ...config };
}

function normalizeCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

function refsFor(db, userId, entityType, entityId) {
  const config = getEntityConfig(entityType);
  return {
    ...config,
    targetRef: db.collection(config.targetCollection).doc(entityId),
    userFollowRef: db
      .collection('userFollows')
      .doc(userId)
      .collection(config.userSubcollection)
      .doc(entityId),
    entityFollowerRef: db
      .collection(config.followerCollection)
      .doc(entityId)
      .collection('followers')
      .doc(userId),
  };
}

export async function listGuestFollows(db, userId) {
  if (!db) throw new Error('Missing Firestore instance');
  const normalizedUserId = requireValue(userId, 'userId');
  const userRef = db.collection('userFollows').doc(normalizedUserId);
  const [venues, hosts] = await Promise.all([
    userRef.collection('venues').get(),
    userRef.collection('hosts').get(),
  ]);

  return {
    venueIds: venues.docs.map((doc) => doc.id),
    hostIds: hosts.docs.map((doc) => doc.id),
  };
}

export async function isGuestFollowing(db, userId, entityType, entityId) {
  if (!db) throw new Error('Missing Firestore instance');
  const normalizedUserId = requireValue(userId, 'userId');
  const normalizedEntityId = requireValue(entityId, 'entityId');
  const { userFollowRef } = refsFor(db, normalizedUserId, entityType, normalizedEntityId);
  return (await userFollowRef.get()).exists;
}

export async function followGuestEntity(
  db,
  userId,
  entityType,
  entityId,
  { displayName = null } = {},
) {
  if (!db) throw new Error('Missing Firestore instance');
  const normalizedUserId = requireValue(userId, 'userId');
  const normalizedEntityId = requireValue(entityId, 'entityId');
  const refs = refsFor(db, normalizedUserId, entityType, normalizedEntityId);

  return db.runTransaction(async (transaction) => {
    const [targetDoc, followDoc, followerDoc] = await Promise.all([
      transaction.get(refs.targetRef),
      transaction.get(refs.userFollowRef),
      transaction.get(refs.entityFollowerRef),
    ]);
    if (!targetDoc.exists) {
      const error = new Error(`${refs.entityType} not found`);
      error.code = 'NOT_FOUND';
      throw error;
    }

    const now = new Date().toISOString();
    const target = targetDoc.data() || {};
    const existingCount = normalizeCount(target.followersCount ?? target.followers);
    const alreadyFollowing = followDoc.exists || followerDoc.exists;
    const followedAt = followDoc.data()?.followedAt || followerDoc.data()?.followedAt || now;
    const nextCount = alreadyFollowing ? existingCount : existingCount + 1;

    transaction.set(
      refs.userFollowRef,
      {
        [`${refs.entityType}Id`]: normalizedEntityId,
        displayName:
          displayName || target.displayName || target.name || target.title || target.handle || null,
        followedAt,
        updatedAt: now,
      },
      { merge: true },
    );
    transaction.set(
      refs.entityFollowerRef,
      {
        userId: normalizedUserId,
        [`${refs.entityType}Id`]: normalizedEntityId,
        followedAt,
        updatedAt: now,
      },
      { merge: true },
    );
    if (!alreadyFollowing) {
      transaction.update(refs.targetRef, {
        followersCount: nextCount,
        followers: nextCount,
        updatedAt: now,
      });
    }

    return {
      following: true,
      entityType: refs.entityType,
      entityId: normalizedEntityId,
      userId: normalizedUserId,
      followersCount: nextCount,
      alreadyFollowing,
    };
  });
}

export async function unfollowGuestEntity(db, userId, entityType, entityId) {
  if (!db) throw new Error('Missing Firestore instance');
  const normalizedUserId = requireValue(userId, 'userId');
  const normalizedEntityId = requireValue(entityId, 'entityId');
  const refs = refsFor(db, normalizedUserId, entityType, normalizedEntityId);

  return db.runTransaction(async (transaction) => {
    const [targetDoc, followDoc, followerDoc] = await Promise.all([
      transaction.get(refs.targetRef),
      transaction.get(refs.userFollowRef),
      transaction.get(refs.entityFollowerRef),
    ]);
    if (!targetDoc.exists) {
      const error = new Error(`${refs.entityType} not found`);
      error.code = 'NOT_FOUND';
      throw error;
    }

    const now = new Date().toISOString();
    const target = targetDoc.data() || {};
    const existingCount = normalizeCount(target.followersCount ?? target.followers);
    const wasFollowing = followDoc.exists || followerDoc.exists;
    const nextCount = wasFollowing ? Math.max(0, existingCount - 1) : existingCount;

    if (followDoc.exists) transaction.delete(refs.userFollowRef);
    if (followerDoc.exists) transaction.delete(refs.entityFollowerRef);
    if (wasFollowing) {
      transaction.update(refs.targetRef, {
        followersCount: nextCount,
        followers: nextCount,
        updatedAt: now,
      });
    }

    return {
      following: false,
      entityType: refs.entityType,
      entityId: normalizedEntityId,
      userId: normalizedUserId,
      followersCount: nextCount,
      wasFollowing,
    };
  });
}
