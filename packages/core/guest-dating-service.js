import {
  getSubscriptionContextForTransaction,
  incrementUsageInTransaction,
  isPremiumProfile,
} from './subscription-service.js';

const USER_LIKES_COLLECTION = 'userLikes';
const USER_MATCHES_COLLECTION = 'userMatches';
const PRIVATE_CONVERSATIONS_COLLECTION = 'privateConversations';
const DISCOVER_PROFILE_LIMIT = 15;
const LEGACY_NIGHTLIFE_VIBES = new Map(
  [
    'House',
    'Techno',
    'Hip-Hop',
    'Afrobeats',
    'Open Format',
    'Rooftops',
    'Cocktail Bars',
    'Dancing',
    'Friends First',
    'Meet Someone',
    'Afterparty',
    'Low-Key',
  ].map((value) => [value.toLowerCase(), value]),
);

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

function ageFromProfile(profile = {}, today = new Date()) {
  const storedAge = Number(profile.age);
  if (Number.isInteger(storedAge) && storedAge > 0 && storedAge < 120) return storedAge;

  const rawDate = profile.dateOfBirth || profile.birthDate || profile.dob;
  const match = typeof rawDate === 'string' ? rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    !Number.isInteger(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > new Date(Date.UTC(year, month, 0)).getUTCDate()
  ) {
    return null;
  }

  let age = today.getUTCFullYear() - year;
  const currentMonth = today.getUTCMonth() + 1;
  const currentDay = today.getUTCDate();
  if (currentMonth < month || (currentMonth === month && currentDay < day)) age -= 1;
  return age > 0 && age < 120 ? age : null;
}

function portableNightlifePhotos(profile = {}) {
  const groups = [profile.datingPhotos, profile.photos];
  for (const group of groups) {
    if (!Array.isArray(group)) continue;
    const photos = group.filter((value) => {
      if (typeof value !== 'string' || value.length > 2048) return false;
      try {
        return new URL(value).protocol === 'https:';
      } catch {
        return false;
      }
    });
    if (photos.length > 0) return [...new Set(photos)].slice(0, 6);
  }

  const avatar = avatarFromProfile(profile);
  if (typeof avatar !== 'string') return [];
  try {
    return new URL(avatar).protocol === 'https:' ? [avatar] : [];
  } catch {
    return [];
  }
}

function nightlifeVibesFromProfile(profile = {}) {
  if (Array.isArray(profile.nightlifeVibeTags)) {
    return [
      ...new Set(
        profile.nightlifeVibeTags
          .filter((value) => typeof value === 'string' && value.trim())
          .map((value) => value.trim()),
      ),
    ].slice(0, 8);
  }

  // Compatibility bridge for profiles created by the retired wizard. Consumer onboarding
  // values such as `live_music` are deliberately excluded from Nightlife profile output.
  if (!Array.isArray(profile.vibeTags)) return [];
  return [
    ...new Set(
      profile.vibeTags
        .filter((value) => typeof value === 'string')
        .map((value) => LEGACY_NIGHTLIFE_VIBES.get(value.trim().toLowerCase()))
        .filter(Boolean),
    ),
  ].slice(0, 8);
}

function publicNightlifeProfile(profileId, profile = {}) {
  const vibes = nightlifeVibesFromProfile(profile);
  const vitals =
    profile.datingVitals && typeof profile.datingVitals === 'object'
      ? profile.datingVitals
      : {};
  return {
    id: profileId,
    userId: profileId,
    firstName: firstNameOnly(profile.name || profile.displayName || profile.fullName),
    displayName: displayNameFromProfile(profile),
    age: ageFromProfile(profile),
    photos: portableNightlifePhotos(profile),
    prompts: Array.isArray(profile.prompts) ? profile.prompts : [],
    upcomingEvents: Array.isArray(profile.upcomingEvents) ? profile.upcomingEvents : [],
    city: profile.city || vitals.location || null,
    datingVitals: vitals,
    vitals,
    nightlifeVibeTags: vibes,
    vibeTags: vibes,
    anthem: profile.anthem || null,
    bio: profile.bio || null,
    headline: profile.headline || null,
    isVerified: Boolean(profile.isVerified || profile.verified),
    isPremium: isPremiumProfile(profile),
  };
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

async function enrichLike(db, like, isPremiumViewer = false) {
  const [profile, event] = await Promise.all([
    getUserProfile(db, like.fromUserId),
    getEventSnapshot(db, like.eventId),
  ]);
  const superLike = isSuperLike(like);
  const createdAt =
    typeof like.createdAt?.toDate === 'function'
      ? like.createdAt.toDate().toISOString()
      : like.createdAt || null;

  const baseProfile = {
    userId: like.fromUserId,
    displayName: displayNameFromProfile(profile, like.fromUserName || 'C1RCLE member'),
    photoURL: portableNightlifePhotos(profile)[0] || like.fromUserAvatar || null,
  };

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
    profile: isPremiumViewer
      ? {
          ...baseProfile,
          bio: profile.bio || null,
          city: profile.city || null,
          vibeTags: nightlifeVibesFromProfile(profile),
          isVerified: Boolean(profile.isVerified || profile.verified),
        }
      : baseProfile,
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
  const likes = await Promise.all(visible.map((like) => enrichLike(db, like, hasPremiumAccess)));

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

export async function getDiscoverProfiles(db, userId, { cursor = null } = {}) {
  if (!userId) throw new Error('userId is required');

  const currentUserDoc = await db.collection('users').doc(userId).get();
  const currentUser = currentUserDoc.exists ? currentUserDoc.data() : {};
  const myEvents = Array.isArray(currentUser.upcomingEvents) ? currentUser.upcomingEvents : [];

  let profilesQuery = db
    .collection('users')
    .where('datingActive', '==', true)
    .orderBy('__name__')
    .limit(DISCOVER_PROFILE_LIMIT);
  if (cursor) {
    profilesQuery = profilesQuery.startAfter(String(cursor));
  }

  const profilesSnap = await profilesQuery.get();
  const profileDocs = profilesSnap.docs || [];
  const swipeDocs = await Promise.all(
    profileDocs.map((doc) =>
      db
        .collection('userSwipes')
        .doc(`${userId}_${doc.id}`)
        .get()
        .catch(() => null),
    ),
  );
  const swipedUserIds = new Set(
    swipeDocs
      .filter((doc) => doc?.exists)
      .map((doc) => doc.data()?.toUserId)
      .filter(Boolean),
  );
  swipedUserIds.add(userId);

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const candidates = [];

  profileDocs.forEach((doc) => {
    const profileId = doc.id;
    if (swipedUserIds.has(profileId)) return;

    const data = doc.data();
    const premiumPriority = isPremiumProfile(data) ? 1 : 0;

    const lastActive = data.lastActiveAt ? new Date(data.lastActiveAt) : new Date(0);
    if (lastActive < fourteenDaysAgo) return;

    const theirEvents = Array.isArray(data.upcomingEvents) ? data.upcomingEvents : [];
    const overlapCount = theirEvents.filter((e) => myEvents.includes(e)).length;

    const candidateProfile = publicNightlifeProfile(profileId, data);
    if (candidateProfile.photos.length < 1) return;

    candidates.push({
      ...candidateProfile,
      _overlapScore: overlapCount,
      _premiumPriority: premiumPriority,
    });
  });

  candidates.sort((a, b) => {
    const priorityDelta = b._premiumPriority - a._premiumPriority;
    if (priorityDelta !== 0) return priorityDelta;
    return b._overlapScore - a._overlapScore;
  });

  const profiles = candidates.map((c) => {
    delete c._overlapScore;
    delete c._premiumPriority;
    return c;
  });
  const lastVisible = profileDocs[profileDocs.length - 1];

  return {
    profiles,
    nextCursor:
      profileDocs.length === DISCOVER_PROFILE_LIMIT && lastVisible ? lastVisible.id : null,
    hasMore: profileDocs.length === DISCOVER_PROFILE_LIMIT,
    limit: DISCOVER_PROFILE_LIMIT,
  };
}

/**
 * Process a swipe action (like or pass).
 * Enforces daily like limits for non-premium users, records the swipe, and handles mutual matches.
 */
export async function processSwipeAction(db, userId, targetUserId, action, options = {}) {
  if (!userId || !targetUserId || !['like', 'pass', 'askOut'].includes(action)) {
    throw new Error('Invalid arguments');
  }

  const swipeDocId = `${userId}_${targetUserId}`;
  const swipeRef = db.collection('userSwipes').doc(swipeDocId);
  const now = new Date().toISOString();
  const likeRef = db.collection(USER_LIKES_COLLECTION).doc(`${userId}_${targetUserId}`);
  const mutualSwipeRef = db.collection('userSwipes').doc(`${targetUserId}_${userId}`);
  const eventId = options.eventId || null;
  const eventKey = safeIdPart(eventId || 'global');
  let response = { match: false };
  let subscriptionContext = null;

  await db.runTransaction(async (transaction) => {
    const swipeDoc = await transaction.get(swipeRef);
    if (swipeDoc.exists) {
      throw new Error('You have already swiped on this user');
    }

    let context = await getSubscriptionContextForTransaction(db, transaction, userId, {
      resetUsage: false,
    });
    const mutualSwipeDoc = action === 'pass' ? null : await transaction.get(mutualSwipeRef);
    const mutualData = mutualSwipeDoc?.exists ? mutualSwipeDoc.data() || {} : {};

    if (action === 'like') {
      context = incrementUsageInTransaction(transaction, context, 'like');
    }
    if (action === 'askOut') {
      context = incrementUsageInTransaction(transaction, context, 'askOut');
    }
    subscriptionContext = {
      subscription: context.subscription,
      usage: context.usage,
      limits: context.limits,
    };

    const swipeAction = action === 'askOut' ? 'like' : action;
    transaction.set(swipeRef, {
      fromUserId: userId,
      toUserId: targetUserId,
      action: swipeAction,
      type: action,
      message: options.message || null,
      eventId,
      createdAt: now,
    });

    if (action === 'pass') {
      response = { match: false, subscription: context.subscription, usage: context.usage };
      return;
    }

    transaction.set(
      likeRef,
      {
        fromUserId: userId,
        toUserId: targetUserId,
        eventId,
        status: 'pending',
        isDeleted: false,
        type: action === 'askOut' ? 'ask_out' : 'like',
        message: options.message || null,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    );

    if (mutualSwipeDoc?.exists && mutualData.action === 'like') {
      const deterministicPair = pairKey(userId, targetUserId);
      const matchId = `match_${eventKey}_${deterministicPair}`;
      const conversationId = `dm_${eventKey}_${deterministicPair}`;
      const participants = [userId, targetUserId];

      const match = {
        id: matchId,
        user1Id: userId,
        user2Id: targetUserId,
        eventId,
        status: 'active',
        conversationId,
        matchedAt: now,
        updatedAt: now,
      };

      const conversation = {
        id: conversationId,
        eventId,
        participants,
        status: 'accepted',
        initiatedBy: targetUserId,
        acceptedAt: now,
        createdAt: now,
        updatedAt: now,
        source: 'dating_like',
        matchId,
        isSaved: true,
      };

      transaction.set(
        likeRef,
        { status: 'accepted', matchId, conversationId, updatedAt: now },
        { merge: true },
      );
      transaction.set(
        db.collection(USER_LIKES_COLLECTION).doc(`${targetUserId}_${userId}`),
        { status: 'accepted', matchId, conversationId, updatedAt: now },
        { merge: true },
      );
      transaction.set(db.collection(USER_MATCHES_COLLECTION).doc(matchId), match, { merge: true });
      transaction.set(
        db.collection(PRIVATE_CONVERSATIONS_COLLECTION).doc(conversationId),
        conversation,
        {
          merge: true,
        },
      );

      response = {
        match: true,
        conversationId,
        subscription: context.subscription,
        usage: context.usage,
        limits: context.limits,
      };
      return;
    }

    response = {
      match: false,
      subscription: context.subscription,
      usage: context.usage,
      limits: context.limits,
      askOut: action === 'askOut',
    };
  });

  return { ...response, ...subscriptionContext };
}

export async function getPublicUserProfile(db, targetUserId) {
  if (!targetUserId) throw new Error('targetUserId is required');

  const doc = await db.collection('users').doc(targetUserId).get();
  if (!doc.exists) {
    throw new Error('User not found');
  }

  const data = doc.data();

  return {
    ...publicNightlifeProfile(doc.id, data),
    datingActive: Boolean(data.datingActive),
  };
}

function firstNameOnly(nameStr) {
  if (!nameStr) return 'User';
  return nameStr.trim().split(' ')[0];
}

export async function getUserMatches(db, userId) {
  if (!userId) throw new Error('userId is required');

  const MATCH_LIMIT = 30;

  const [snap1, snap2] = await Promise.all([
    db.collection('userMatches').where('user1Id', '==', userId).limit(MATCH_LIMIT).get(),
    db.collection('userMatches').where('user2Id', '==', userId).limit(MATCH_LIMIT).get(),
  ]);

  const matchDocs = [...snap1.docs, ...snap2.docs];

  const matches = matchDocs.map((doc) => ({ id: doc.id, ...doc.data() }));
  matches.sort((a, b) => {
    const timeA = a.matchedAt ? new Date(a.matchedAt).getTime() : 0;
    const timeB = b.matchedAt ? new Date(b.matchedAt).getTime() : 0;
    return timeB - timeA;
  });

  const topMatches = matches.slice(0, MATCH_LIMIT);

  const otherUserIds = topMatches.map((match) =>
    match.user1Id === userId ? match.user2Id : match.user1Id,
  );

  const uniqueIds = [...new Set(otherUserIds)];

  const profileMap = new Map();
  if (uniqueIds.length > 0) {
    try {
      const profileRefs = uniqueIds.map((id) => db.collection('users').doc(id));
      const snapshots = await db.getAll(...profileRefs);
      snapshots.forEach((doc) => {
        if (!doc.exists) return;
        const data = doc.data();
        profileMap.set(doc.id, {
          id: doc.id,
          firstName: firstNameOnly(data.name || data.displayName || data.fullName),
          age: ageFromProfile(data),
          photo:
            portableNightlifePhotos(data)[0] || null,
          displayName: displayNameFromProfile(data),
          photoURL: avatarFromProfile(data),
          isPremium: isPremiumProfile(data),
        });
      });
    } catch (e) {
      console.warn('Failed to batch-fetch match profiles', e);
    }
  }

  const enrichedMatches = topMatches.map((match) => {
    const otherUserId = match.user1Id === userId ? match.user2Id : match.user1Id;
    return {
      matchId: match.id,
      conversationId: match.conversationId,
      matchedAt: match.matchedAt,
      eventTitle: match.eventTitle || 'Shared Event',
      profile: profileMap.get(otherUserId) || null,
    };
  });

  return enrichedMatches;
}
