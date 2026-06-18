const USER_LIKES_COLLECTION = 'userLikes';
const USER_MATCHES_COLLECTION = 'userMatches';
const PRIVATE_CONVERSATIONS_COLLECTION = 'privateConversations';

function nowIso() {
  return new Date().toISOString();
}

function serializeDoc(doc) {
  if (!doc?.exists && !doc?.data) return null;
  const data = typeof doc.data === 'function' ? doc.data() || {} : {};
  return { id: doc.id, ...data };
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function isPremiumProfile(profile = {}) {
  const subscription = profile.subscription || profile.membership || {};
  const status = String(
    profile.subscriptionStatus || profile.membershipStatus || subscription.status || '',
  ).toLowerCase();

  return (
    profile.isPremium === true ||
    profile.c1rclePlus === true ||
    subscription.isPremium === true ||
    status === 'active' ||
    status === 'trialing'
  );
}

function displayNameFromProfile(profile = {}, fallback = 'C1RCLE member') {
  return (
    profile.displayName ||
    profile.name ||
    profile.fullName ||
    profile.userName ||
    profile.email ||
    fallback
  );
}

function avatarFromProfile(profile = {}) {
  return profile.photoURL || profile.avatar || profile.image || profile.profileImage || null;
}

async function getUserProfile(db, userId) {
  if (!userId) return {};
  const doc = await db
    .collection('users')
    .doc(userId)
    .get()
    .catch(() => null);
  return doc?.exists ? { id: doc.id, ...(doc.data() || {}) } : {};
}

async function getEventSnapshot(db, eventId) {
  if (!eventId) return {};
  const doc = await db
    .collection('events')
    .doc(eventId)
    .get()
    .catch(() => null);
  return doc?.exists ? { id: doc.id, ...(doc.data() || {}) } : {};
}

function isSuperLike(like = {}) {
  const raw = String(like.type || like.kind || like.direction || like.reaction || '').toLowerCase();
  return Boolean(like.isSuperLike || like.superLike || raw === 'superlike' || raw === 'super_like');
}

function isPendingLike(like = {}) {
  const status = String(like.status || 'pending').toLowerCase();
  return !like.isDeleted && !['accepted', 'rejected', 'deleted', 'expired'].includes(status);
}

function safeIdPart(value) {
  return String(value || 'unknown')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 120);
}

function pairKey(userA, userB) {
  return [safeIdPart(userA), safeIdPart(userB)].sort().join('_');
}

async function findExistingConversation(db, participants, eventId) {
  const [firstUser, secondUser] = participants;
  const snapshot = await db
    .collection(PRIVATE_CONVERSATIONS_COLLECTION)
    .where('participants', 'array-contains', firstUser)
    .where('eventId', '==', eventId)
    .get()
    .catch(() => ({ docs: [] }));

  const existing = (snapshot.docs || [])
    .map((doc) => serializeDoc(doc))
    .find((conversation) => {
      const ids = Array.isArray(conversation?.participants) ? conversation.participants : [];
      return ids.includes(firstUser) && ids.includes(secondUser);
    });

  return existing || null;
}

async function enrichLike(db, like) {
  const [profile, event] = await Promise.all([
    getUserProfile(db, like.fromUserId),
    getEventSnapshot(db, like.eventId),
  ]);
  const superLike = isSuperLike(like);
  const createdAt =
    typeof like.createdAt?.toDate === 'function'
      ? like.createdAt.toDate().toISOString()
      : like.createdAt || null;

  return {
    id: like.id,
    fromUserId: like.fromUserId,
    toUserId: like.toUserId,
    eventId: like.eventId || null,
    eventTitle: like.eventTitle || event.title || event.eventTitle || 'Shared Event',
    createdAt,
    isSuperLike: superLike,
    type: superLike ? 'superlike' : 'like',
    message: like.message || like.comment || null,
    profile: {
      userId: like.fromUserId,
      displayName: displayNameFromProfile(profile, like.fromUserName || 'C1RCLE member'),
      photoURL: avatarFromProfile(profile) || like.fromUserAvatar || null,
      bio: profile.bio || null,
      city: profile.city || null,
      vibeTags: Array.isArray(profile.vibeTags) ? profile.vibeTags : [],
      isVerified: Boolean(profile.isVerified || profile.verified),
    },
  };
}

export async function listReceivedLikes(db, userId) {
  if (!userId) throw new Error('userId is required');

  const viewerProfile = await getUserProfile(db, userId);
  const hasPremiumAccess = isPremiumProfile(viewerProfile);
  const snapshot = await db.collection(USER_LIKES_COLLECTION).where('toUserId', '==', userId).get();

  const pending = (snapshot.docs || [])
    .map((doc) => serializeDoc(doc))
    .filter((like) => like?.fromUserId && isPendingLike(like))
    .sort((left, right) => {
      const superLikeDelta = Number(isSuperLike(right)) - Number(isSuperLike(left));
      if (superLikeDelta !== 0) return superLikeDelta;
      return toMillis(right.createdAt) - toMillis(left.createdAt);
    });

  const visible = hasPremiumAccess ? pending : pending.slice(0, 1);
  const likes = await Promise.all(visible.map((like) => enrichLike(db, like)));

  return {
    likes,
    total: pending.length,
    visibleCount: likes.length,
    lockedCount: Math.max(0, pending.length - likes.length),
    isPremium: hasPremiumAccess,
    access: hasPremiumAccess ? 'full' : 'tease',
    superLikesCount: pending.filter((like) => isSuperLike(like)).length,
  };
}

export async function respondToLikeRequest(db, userId, likeId, { action } = {}) {
  if (!userId || !likeId || !action) throw new Error('userId, likeId and action are required');
  if (!['accept', 'reject'].includes(action)) throw new Error('Invalid action');

  const likeRef = db.collection(USER_LIKES_COLLECTION).doc(likeId);
  const likeDoc = await likeRef.get();
  if (!likeDoc.exists) throw new Error('Like request not found');

  const like = { id: likeDoc.id, ...(likeDoc.data() || {}) };
  if (like.toUserId !== userId) throw new Error('Forbidden');
  if (!isPendingLike(like) && action === 'reject') {
    return { success: true, action: 'reject', likeId, status: 'already_closed' };
  }

  const now = nowIso();

  if (action === 'reject') {
    await likeRef.set(
      {
        status: 'rejected',
        isDeleted: true,
        rejectedAt: now,
        deletedAt: now,
        respondedAt: now,
        respondedBy: userId,
        updatedAt: now,
      },
      { merge: true },
    );
    return { success: true, action: 'reject', likeId, status: 'rejected' };
  }

  const event = await getEventSnapshot(db, like.eventId);
  const eventTitle = like.eventTitle || event.title || event.eventTitle || 'Shared Event';
  const participants = [like.fromUserId, userId];
  const deterministicPair = pairKey(like.fromUserId, userId);
  const eventKey = safeIdPart(like.eventId || 'global');
  const matchId = `match_${eventKey}_${deterministicPair}`;
  const existingConversation = await findExistingConversation(
    db,
    participants,
    like.eventId || null,
  );
  const conversationId = existingConversation?.id || `dm_${eventKey}_${deterministicPair}`;

  const match = {
    id: matchId,
    user1Id: like.fromUserId,
    user2Id: userId,
    eventId: like.eventId || null,
    eventTitle,
    likeId,
    status: 'active',
    conversationId,
    matchedAt: now,
    updatedAt: now,
  };
  const conversation = {
    id: conversationId,
    eventId: like.eventId || null,
    participants,
    status: 'accepted',
    initiatedBy: like.fromUserId,
    acceptedAt: now,
    createdAt: existingConversation?.createdAt || now,
    updatedAt: now,
    source: 'dating_like',
    matchId,
    isSaved: true,
  };

  const batch = db.batch();
  batch.set(
    likeRef,
    {
      status: 'accepted',
      isDeleted: false,
      acceptedAt: now,
      respondedAt: now,
      respondedBy: userId,
      matchId,
      conversationId,
      updatedAt: now,
    },
    { merge: true },
  );
  batch.set(db.collection(USER_MATCHES_COLLECTION).doc(matchId), match, { merge: true });
  batch.set(db.collection(PRIVATE_CONVERSATIONS_COLLECTION).doc(conversationId), conversation, {
    merge: true,
  });
  await batch.commit();

  return {
    success: true,
    action: 'accept',
    likeId,
    match,
    conversation,
  };
}
