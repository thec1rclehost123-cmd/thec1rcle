import {
  FREE_SUBSCRIPTION_LIMITS,
  getDailyUsageDocumentId,
  resolveGuestSubscription,
} from './guest-subscription-service.js';

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
  return resolveGuestSubscription(profile).isPremium;
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

export async function getDiscoverProfiles(db, userId) {
  if (!userId) throw new Error('userId is required');

  const currentUserDoc = await db.collection('users').doc(userId).get();
  const currentUser = currentUserDoc.exists ? currentUserDoc.data() : {};
  const myEvents = Array.isArray(currentUser.upcomingEvents) ? currentUser.upcomingEvents : [];

  const swipesSnap = await db.collection('userSwipes').where('fromUserId', '==', userId).get();
  const swipedUserIds = new Set(swipesSnap.docs.map((doc) => doc.data().toUserId));
  swipedUserIds.add(userId);

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const profilesSnap = await db
    .collection('users')
    .where('datingActive', '==', true)
    .limit(100)
    .get();

  let candidates = [];

  profilesSnap.forEach((doc) => {
    const profileId = doc.id;
    if (swipedUserIds.has(profileId)) return;

    const data = doc.data();

    const lastActive = data.lastActiveAt ? new Date(data.lastActiveAt) : new Date(0);
    if (lastActive < fourteenDaysAgo) return;

    const theirEvents = Array.isArray(data.upcomingEvents) ? data.upcomingEvents : [];
    const overlapCount = theirEvents.filter((e) => myEvents.includes(e)).length;

    candidates.push({
      id: profileId,
      firstName: firstNameOnly(data.name || data.displayName || data.fullName),
      age: data.age || null,
      photos: Array.isArray(data.photos) ? data.photos : data.photoURL ? [data.photoURL] : [],
      prompts: Array.isArray(data.prompts) ? data.prompts : [],
      upcomingEvents: theirEvents,
      _overlapScore: overlapCount,
    });
  });

  candidates.sort((a, b) => b._overlapScore - a._overlapScore);

  return candidates.slice(0, 15).map((c) => {
    delete c._overlapScore;
    return c;
  });
}

/**
 * Process a swipe action (like or pass).
 * Enforces daily like limits for non-premium users, records the swipe, and handles mutual matches.
 */
export async function processSwipeAction(db, userId, targetUserId, action) {
  if (!userId || !targetUserId || !['like', 'pass'].includes(action)) {
    throw new Error('Invalid arguments');
  }

  const currentUserDoc = await db.collection('users').doc(userId).get();
  const currentUser = currentUserDoc.exists ? currentUserDoc.data() : {};
  const isPremium = isPremiumProfile(currentUser);

  // Spam protection: check if swipe already exists
  const swipeDocId = `${userId}_${targetUserId}`;
  const swipeRef = db.collection('userSwipes').doc(swipeDocId);
  const swipeDoc = await swipeRef.get();
  if (swipeDoc.exists) {
    throw new Error('You have already swiped on this user');
  }

  // Paywall Limit check
  if (action === 'like' && !isPremium) {
    const dailyLimitRef = db.collection('userDailyLimits').doc(getDailyUsageDocumentId(userId));

    await db.runTransaction(async (transaction) => {
      const dailyDoc = await transaction.get(dailyLimitRef);
      const data = dailyDoc.exists ? dailyDoc.data() : { likes: 0 };
      const likesUsed = Math.max(0, Number(data.likesUsed ?? data.likes ?? 0) || 0);

      if (likesUsed >= FREE_SUBSCRIPTION_LIMITS.likesPerDay) {
        throw new Error('Daily like limit exceeded');
      }

      transaction.set(
        dailyLimitRef,
        {
          likes: likesUsed + 1,
          likesUsed: likesUsed + 1,
          date: getDailyUsageDocumentId(userId).slice(userId.length + 1),
          updatedAt: nowIso(),
        },
        { merge: true },
      );
    });
  }

  const now = new Date().toISOString();

  // Record the swipe
  await swipeRef.set({
    fromUserId: userId,
    toUserId: targetUserId,
    action,
    createdAt: now,
  });

  if (action === 'pass') {
    return { match: false };
  }

  // Save to USER_LIKES_COLLECTION for compatibility if it's a like
  const likeRef = db.collection(USER_LIKES_COLLECTION).doc(`${userId}_${targetUserId}`);
  await likeRef.set({
    fromUserId: userId,
    toUserId: targetUserId,
    status: 'pending',
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  });

  // Mutual Match Check
  // Has the target already swiped right on the current user?
  const mutualSwipeDoc = await db.collection('userSwipes').doc(`${targetUserId}_${userId}`).get();

  if (mutualSwipeDoc.exists && mutualSwipeDoc.data().action === 'like') {
    // Create match and DM
    const deterministicPair = pairKey(userId, targetUserId);
    const eventKey = 'global'; // Or try to find overlapping event, but 'global' is safe
    const matchId = `match_${eventKey}_${deterministicPair}`;
    const conversationId = `dm_${eventKey}_${deterministicPair}`;

    const participants = [userId, targetUserId];

    const match = {
      id: matchId,
      user1Id: userId,
      user2Id: targetUserId,
      eventId: null,
      status: 'active',
      conversationId,
      matchedAt: now,
      updatedAt: now,
    };

    const conversation = {
      id: conversationId,
      eventId: null,
      participants,
      status: 'accepted',
      initiatedBy: targetUserId, // They liked first
      acceptedAt: now,
      createdAt: now,
      updatedAt: now,
      source: 'dating_like',
      matchId,
      isSaved: true,
    };

    const batch = db.batch();

    // Update both like documents to accepted
    batch.set(
      likeRef,
      { status: 'accepted', matchId, conversationId, updatedAt: now },
      { merge: true },
    );
    batch.set(
      db.collection(USER_LIKES_COLLECTION).doc(`${targetUserId}_${userId}`),
      { status: 'accepted', matchId, conversationId, updatedAt: now },
      { merge: true },
    );

    // Create match and conversation
    batch.set(db.collection(USER_MATCHES_COLLECTION).doc(matchId), match, { merge: true });
    batch.set(db.collection(PRIVATE_CONVERSATIONS_COLLECTION).doc(conversationId), conversation, {
      merge: true,
    });

    await batch.commit();

    return { match: true, conversationId };
  }

  return { match: false };
}

export async function getPublicUserProfile(db, targetUserId) {
  if (!targetUserId) throw new Error('targetUserId is required');

  const doc = await db.collection('users').doc(targetUserId).get();
  if (!doc.exists) {
    throw new Error('User not found');
  }

  const data = doc.data();

  return {
    id: doc.id,
    firstName: firstNameOnly(data.name || data.displayName || data.fullName),
    age: data.age || null,
    photos: Array.isArray(data.photos) ? data.photos : data.photoURL ? [data.photoURL] : [],
    prompts: Array.isArray(data.prompts) ? data.prompts : [],
    upcomingEvents: Array.isArray(data.upcomingEvents) ? data.upcomingEvents : [],
    datingActive: Boolean(data.datingActive),
  };
}

function firstNameOnly(nameStr) {
  if (!nameStr) return 'User';
  return nameStr.trim().split(' ')[0];
}

export async function getUserMatches(db, userId) {
  if (!userId) throw new Error('userId is required');

  // Firestore requires a composite index for OR queries or we can run two parallel queries
  // since userMatches has user1Id and user2Id
  const [snap1, snap2] = await Promise.all([
    db.collection('userMatches').where('user1Id', '==', userId).get(),
    db.collection('userMatches').where('user2Id', '==', userId).get(),
  ]);

  const matchDocs = [...snap1.docs, ...snap2.docs];

  // Sort by matchedAt descending
  const matches = matchDocs.map((doc) => ({ id: doc.id, ...doc.data() }));
  matches.sort((a, b) => {
    const timeA = a.matchedAt ? new Date(a.matchedAt).getTime() : 0;
    const timeB = b.matchedAt ? new Date(b.matchedAt).getTime() : 0;
    return timeB - timeA;
  });

  // Enrich with public profile of the other user
  const enrichedMatches = await Promise.all(
    matches.map(async (match) => {
      const otherUserId = match.user1Id === userId ? match.user2Id : match.user1Id;
      let otherProfile = null;

      try {
        const doc = await db.collection('users').doc(otherUserId).get();
        if (doc.exists) {
          const data = doc.data();
          otherProfile = {
            id: otherUserId,
            firstName: firstNameOnly(data.name || data.displayName || data.fullName),
            age: data.age || null,
            photo:
              Array.isArray(data.photos) && data.photos.length > 0
                ? data.photos[0]
                : data.photoURL || null,
          };
        }
      } catch (e) {
        console.warn('Failed to fetch profile for match', otherUserId);
      }

      return {
        matchId: match.id,
        conversationId: match.conversationId,
        matchedAt: match.matchedAt,
        profile: otherProfile,
      };
    }),
  );

  return enrichedMatches;
}
