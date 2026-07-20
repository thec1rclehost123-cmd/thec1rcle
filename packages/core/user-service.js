import { buildDefaultSubscription, normalizeSubscription } from './subscription-service.js';
import { createHash } from 'node:crypto';

const DEFAULT_USER_ROLE = 'guest';

function nowIso() {
  return new Date().toISOString();
}

function canonicalClaims(existing = {}, role = DEFAULT_USER_ROLE) {
  return {
    ...existing,
    role: existing.role || role,
    roles: Array.isArray(existing.roles) && existing.roles.length > 0 ? existing.roles : [role],
    app: existing.app || 'thec1rcle',
  };
}

function canonicalUserContract(userId, data, { isNewUser = false, claims = {} } = {}) {
  const role = claims.role || data.role || DEFAULT_USER_ROLE;
  const subscription = normalizeSubscription(data);
  return {
    id: userId,
    uid: userId,
    email: data.email || null,
    phoneNumber: data.phoneNumber || null,
    displayName: data.displayName || data.name || '',
    name: data.name || data.displayName || '',
    photoURL: data.photoURL || data.avatar || null,
    avatar: data.avatar || data.photoURL || null,
    role,
    roles: Array.isArray(claims.roles) ? claims.roles : [role],
    claims,
    onboardingComplete: data.onboardingComplete === true,
    profileComplete: data.profileComplete === true,
    datingActive: data.datingActive === true,
    subscription: data.subscription || buildDefaultSubscription(data.updatedAt || nowIso()),
    isPremium: subscription.isPremium,
    supportQueue: subscription.supportQueue,
    isActive: data.isActive !== false,
    isDeleted: data.isDeleted === true,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    lastLoginAt: data.lastLoginAt || null,
    lastAuthSyncAt: data.lastAuthSyncAt || null,
    isNewUser,
  };
}

async function ensureDefaultClaims(auth, userId, authRecord = {}) {
  if (!auth || typeof auth.setCustomUserClaims !== 'function') {
    return canonicalClaims(authRecord.customClaims || {});
  }

  const existingClaims = authRecord.customClaims || {};
  const claims = canonicalClaims(existingClaims, existingClaims.role || DEFAULT_USER_ROLE);
  const needsUpdate =
    existingClaims.role !== claims.role ||
    !Array.isArray(existingClaims.roles) ||
    existingClaims.roles.length === 0 ||
    existingClaims.app !== claims.app;

  if (needsUpdate) {
    await auth.setCustomUserClaims(userId, claims);
  }

  return claims;
}

export async function syncAuthUser(db, userId, authRecord, options = {}) {
  if (!userId) throw new Error('Missing userId');

  const auth = options.auth || null;
  const now = nowIso();
  const claims = await ensureDefaultClaims(auth, userId, authRecord);
  const userRef = db.collection('users').doc(userId);
  const doc = await userRef.get();

  if (!doc.exists) {
    const baseline = {
      uid: userId,
      email: authRecord?.email || null,
      emailVerified: authRecord?.emailVerified === true || authRecord?.email_verified === true,
      phone: authRecord?.phoneNumber || authRecord?.phone_number || null,
      phoneNumber: authRecord?.phoneNumber || authRecord?.phone_number || null,
      name: authRecord?.displayName || '',
      displayName: authRecord?.displayName || '',
      photoURL: authRecord?.photoURL || null,
      avatar: authRecord?.photoURL || null,
      role: claims.role || DEFAULT_USER_ROLE,
      roles: claims.roles || [DEFAULT_USER_ROLE],
      datingActive: false,
      subscription: buildDefaultSubscription(now),
      isActive: true,
      isDeleted: false,
      onboardingComplete: false,
      profileComplete: false,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
      lastAuthSyncAt: now,
    };

    await userRef.set(baseline);
    return canonicalUserContract(userId, baseline, { isNewUser: true, claims });
  }

  const existing = doc.data() || {};
  const patch = {
    email: authRecord?.email || null,
    emailVerified: authRecord?.emailVerified === true || authRecord?.email_verified === true,
    phone: authRecord?.phoneNumber || authRecord?.phone_number || null,
    phoneNumber: authRecord?.phoneNumber || authRecord?.phone_number || null,
    displayName: existing.displayName || existing.name || authRecord?.displayName || '',
    name: existing.name || existing.displayName || authRecord?.displayName || '',
    photoURL: existing.photoURL || authRecord?.photoURL || null,
    avatar: existing.avatar || existing.photoURL || authRecord?.photoURL || null,
    role: existing.role || claims.role || DEFAULT_USER_ROLE,
    roles:
      Array.isArray(existing.roles) && existing.roles.length > 0 ? existing.roles : claims.roles,
    subscription: existing.subscription || buildDefaultSubscription(now),
    isActive: existing.isActive !== false,
    isDeleted: existing.isDeleted === true,
    updatedAt: now,
    lastLoginAt: now,
    lastAuthSyncAt: now,
  };

  await userRef.set(patch, { merge: true });
  return canonicalUserContract(userId, { ...existing, ...patch }, { isNewUser: false, claims });
}

function pushTokenHash(token) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function deviceTokenRecordId(userId, deviceId) {
  return createHash('sha256').update(`${userId}\u0000${deviceId}`, 'utf8').digest('hex');
}

function uniquePushTokens(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === 'string' && value))];
}

function withoutPushToken(values, token) {
  return uniquePushTokens(values).filter((value) => value !== token);
}

function queryDocuments(...snapshots) {
  const documents = new Map();
  for (const snapshot of snapshots) {
    for (const document of snapshot?.docs || []) {
      documents.set(document.ref.path, document);
    }
  }
  return [...documents.values()];
}

function tokenOwnerIds(claim, tokenDocuments, currentUserId) {
  const owners = new Set([currentUserId]);
  if (claim?.userId) owners.add(String(claim.userId));
  for (const document of tokenDocuments) {
    const owner = document.data()?.userId;
    if (owner) owners.add(String(owner));
  }
  return [...owners];
}

export async function registerDeviceToken(db, userId, payload = {}) {
  if (!userId) throw new Error('Missing userId');
  const token = String(payload.token || '').trim();
  if (!token) throw new Error('Missing device token');

  const now = nowIso();
  const platform = String(payload.platform || 'unknown').slice(0, 40);
  const tokenHash = pushTokenHash(token);
  const deviceId = String(
    payload.deviceId || payload.installationId || `${platform}-${tokenHash.slice(0, 24)}`,
  ).slice(0, 180);
  const projectId = payload.projectId ? String(payload.projectId).slice(0, 120) : null;
  const appVersion = payload.appVersion ? String(payload.appVersion).slice(0, 80) : null;
  const installationId = payload.installationId
    ? String(payload.installationId).slice(0, 180)
    : null;

  const claimRef = db.collection('deviceTokenClaims').doc(tokenHash);
  const currentDeviceRef = db
    .collection('deviceTokens')
    .doc(deviceTokenRecordId(userId, deviceId));
  const rawTokenQuery = db.collection('deviceTokens').where('token', '==', token);
  const tokenHashQuery = db.collection('deviceTokens').where('tokenHash', '==', tokenHash);

  return db.runTransaction(async (transaction) => {
    const [claimDoc, rawTokenSnapshot, tokenHashSnapshot, currentDeviceDoc] = await Promise.all([
      transaction.get(claimRef),
      transaction.get(rawTokenQuery),
      transaction.get(tokenHashQuery),
      transaction.get(currentDeviceRef),
    ]);
    const claim = claimDoc.exists ? claimDoc.data() || {} : null;
    const tokenDocuments = queryDocuments(rawTokenSnapshot, tokenHashSnapshot);
    const previousDeviceRecord = currentDeviceDoc.exists ? currentDeviceDoc.data() || {} : null;
    const previousDeviceToken =
      previousDeviceRecord?.token && previousDeviceRecord.token !== token
        ? String(previousDeviceRecord.token)
        : null;
    const previousDeviceTokenHash = previousDeviceToken
      ? String(previousDeviceRecord.tokenHash || pushTokenHash(previousDeviceToken))
      : null;
    const previousClaimRef = previousDeviceTokenHash
      ? db.collection('deviceTokenClaims').doc(previousDeviceTokenHash)
      : null;
    const previousClaimDoc = previousClaimRef
      ? await transaction.get(previousClaimRef)
      : null;
    const ownerIds = tokenOwnerIds(claim, tokenDocuments, userId);
    const userDocuments = await Promise.all(
      ownerIds.map(async (ownerId) => {
        const ref = db.collection('users').doc(ownerId);
        const doc = await transaction.get(ref);
        return { ownerId, ref, doc };
      }),
    );

    const record = {
      id: deviceId,
      userId,
      token,
      tokenHash,
      provider: payload.provider || 'expo',
      platform,
      projectId,
      appVersion,
      installationId,
      isActive: true,
      updatedAt: now,
      lastSeenAt: now,
      createdAt: previousDeviceRecord?.createdAt || payload.createdAt || now,
      revokedAt: null,
      revocationReason: null,
    };

    for (const document of tokenDocuments) {
      if (document.ref.path === currentDeviceRef.path) continue;
      transaction.set(
        document.ref,
        {
          token: null,
          tokenHash,
          isActive: false,
          revokedAt: now,
          revocationReason: 'reassigned',
          reassignedAt: now,
          updatedAt: now,
        },
        { merge: true },
      );
    }

    for (const { ownerId, ref, doc } of userDocuments) {
      const user = doc.exists ? doc.data() || {} : {};
      const remainingWithoutCurrent = withoutPushToken(user.pushTokens, token);
      const remaining = previousDeviceToken
        ? withoutPushToken(remainingWithoutCurrent, previousDeviceToken)
        : remainingWithoutCurrent;
      if (ownerId === userId) {
        const pushTokens = uniquePushTokens([...remaining, token]);
        transaction.set(
          ref,
          {
            pushToken: token,
            pushTokens,
            lastTokenUpdate: now,
            updatedAt: now,
          },
          { merge: true },
        );
      } else {
        transaction.set(
          ref,
          {
            pushToken: user.pushToken === token ? remaining[0] || null : user.pushToken || null,
            pushTokens: remaining,
            lastTokenUpdate: now,
            updatedAt: now,
          },
          { merge: true },
        );
      }
    }

    if (previousClaimRef && previousClaimDoc?.exists) {
      const previousClaim = previousClaimDoc.data() || {};
      if (
        previousClaim.userId === userId &&
        previousClaim.deviceTokenDocId === currentDeviceRef.id
      ) {
        transaction.delete(previousClaimRef);
      }
    }

    transaction.set(currentDeviceRef, record, { merge: true });
    transaction.set(
      claimRef,
      {
        version: 1,
        tokenHash,
        userId,
        deviceId,
        deviceTokenDocId: currentDeviceRef.id,
        provider: record.provider,
        platform,
        claimedAt: claim?.userId === userId ? claim.claimedAt || now : now,
        updatedAt: now,
      },
      { merge: false },
    );

    return {
      success: true,
      reassigned: ownerIds.some((ownerId) => ownerId !== userId),
      deviceToken: record,
    };
  });
}

export async function revokeDeviceToken(db, userId, payload = {}) {
  if (!userId) throw new Error('Missing userId');
  const token = String(payload.token || '').trim();
  if (!token) throw new Error('Missing device token');

  const now = nowIso();
  const tokenHash = pushTokenHash(token);
  const claimRef = db.collection('deviceTokenClaims').doc(tokenHash);
  const rawTokenQuery = db.collection('deviceTokens').where('token', '==', token);
  const tokenHashQuery = db.collection('deviceTokens').where('tokenHash', '==', tokenHash);
  const userRef = db.collection('users').doc(userId);

  return db.runTransaction(async (transaction) => {
    const [claimDoc, rawTokenSnapshot, tokenHashSnapshot, userDoc] = await Promise.all([
      transaction.get(claimRef),
      transaction.get(rawTokenQuery),
      transaction.get(tokenHashQuery),
      transaction.get(userRef),
    ]);
    const claim = claimDoc.exists ? claimDoc.data() || {} : null;
    const claimOwnedByCaller = claim?.userId === userId && claim?.tokenHash === tokenHash;
    const callerTokenDocuments = queryDocuments(rawTokenSnapshot, tokenHashSnapshot).filter(
      (document) => {
        const data = document.data() || {};
        return data.userId === userId && (data.isActive === true || data.token === token);
      },
    );
    const user = userDoc.exists ? userDoc.data() || {} : {};
    const remaining = withoutPushToken(user.pushTokens, token);
    const hadMirror = user.pushToken === token || remaining.length !== uniquePushTokens(user.pushTokens).length;

    for (const document of callerTokenDocuments) {
      transaction.set(
        document.ref,
        {
          token: null,
          tokenHash,
          isActive: false,
          revokedAt: now,
          revocationReason: 'logout',
          updatedAt: now,
        },
        { merge: true },
      );
    }

    if (claimOwnedByCaller) transaction.delete(claimRef);

    if (userDoc.exists || hadMirror) {
      transaction.set(
        userRef,
        {
          pushToken: user.pushToken === token ? remaining[0] || null : user.pushToken || null,
          pushTokens: remaining,
          lastTokenUpdate: now,
          updatedAt: now,
        },
        { merge: true },
      );
    }

    const revoked = claimOwnedByCaller || callerTokenDocuments.length > 0 || hadMirror;
    return {
      success: true,
      revoked,
      alreadyRevoked: !revoked,
    };
  });
}

export async function listUserFollows(db, userId) {
  if (!userId) throw new Error('Missing userId');

  const [legacyVenues, legacyHosts, graphVenues, graphHosts] = await Promise.all([
    db.collection('userFollows').doc(userId).collection('venues').get(),
    db.collection('userFollows').doc(userId).collection('hosts').get(),
    db
      .collection('follows')
      .where('followerId', '==', userId)
      .where('targetType', '==', 'venue')
      .get(),
    db
      .collection('follows')
      .where('followerId', '==', userId)
      .where('targetType', '==', 'host')
      .get(),
  ]);

  const venueIds = new Set(legacyVenues.docs.map((doc) => doc.id));
  const hostIds = new Set(legacyHosts.docs.map((doc) => doc.id));

  for (const doc of graphVenues.docs) {
    const data = doc.data() || {};
    if (data.targetId) venueIds.add(String(data.targetId));
  }

  for (const doc of graphHosts.docs) {
    const data = doc.data() || {};
    if (data.targetId) hostIds.add(String(data.targetId));
  }

  return {
    venueIds: Array.from(venueIds),
    hostIds: Array.from(hostIds),
  };
}

export async function submitVerificationAttempt(db, userId, payload = {}) {
  if (!userId) throw new Error('Missing userId');

  const now = nowIso();
  const status = payload.status || 'pending';
  const attempt = {
    userId,
    type: payload.type || 'profile',
    status,
    result: status,
    selfieUrl: payload.selfieUrl || null,
    displayName: payload.displayName || null,
    email: payload.email || null,
    photoURL: payload.photoURL || null,
    metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {},
    matchScore: payload.matchScore ?? null,
    attemptedAt: now,
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const batch = db.batch();
  const attemptRef = db.collection('verificationAttempts').doc(userId).collection('attempts').doc();
  batch.set(attemptRef, attempt);
  batch.set(
    db.collection('verificationRequests').doc(userId),
    {
      userId,
      displayName: attempt.displayName,
      email: attempt.email,
      photoURL: attempt.photoURL,
      status,
      latestAttemptId: attemptRef.id,
      submittedAt: now,
      updatedAt: now,
    },
    { merge: true },
  );
  batch.set(
    db.collection('users').doc(userId),
    {
      verificationStatus: status,
      isVerified: status === 'verified',
      updatedAt: now,
    },
    { merge: true },
  );
  await batch.commit();

  return {
    success: true,
    attempt: { id: attemptRef.id, ...attempt },
    verificationStatus: status,
  };
}

export async function getPrivateProfile(db, userId) {
  if (!userId) throw new Error('Missing userId');

  const doc = await db.collection('users').doc(userId).get();
  if (!doc.exists) {
    throw new Error('User not found');
  }

  return { id: doc.id, ...doc.data() };
}

export async function updateProfile(db, userId, updates) {
  if (!userId) throw new Error('Missing userId');

  const userRef = db.collection('users').doc(userId);
  const doc = await userRef.get();

  if (!doc.exists) {
    throw new Error('User not found');
  }

  const trustedFields = new Set([
    'email',
    'emailVerified',
    'phone',
    'phoneNumber',
    'phoneNumberE164',
    'phoneVerifiedAt',
    'auth',
    'consumerOnboarding',
    'basicSetupComplete',
    'profileSetupComplete',
    'profileComplete',
    'onboardingComplete',
  ]);
  const rejectedFields = Object.keys(updates || {}).filter((key) => trustedFields.has(key));
  if (rejectedFields.length > 0) {
    const error = new Error(
      `Trusted profile fields cannot be updated here: ${rejectedFields.join(', ')}`,
    );
    error.code = 'TRUSTED_FIELD_UPDATE_REJECTED';
    error.statusCode = 400;
    throw error;
  }

  const safeUpdates = { ...updates, updatedAt: new Date().toISOString() };

  await userRef.update(safeUpdates);

  const updatedDoc = await userRef.get();
  return { id: updatedDoc.id, ...updatedDoc.data() };
}

export async function blockUser(db, userId, targetUserId) {
  if (!userId || !targetUserId) throw new Error('Missing userId or targetUserId');

  const userRef = db.collection('users').doc(userId);
  const doc = await userRef.get();

  if (!doc.exists) {
    throw new Error('User not found');
  }

  const data = doc.data();
  const blockedUsers = Array.isArray(data.blockedUsers) ? data.blockedUsers : [];

  if (!blockedUsers.includes(targetUserId)) {
    blockedUsers.push(targetUserId);
    await userRef.update({
      blockedUsers,
      updatedAt: new Date().toISOString(),
    });
  }

  return { success: true, blockedUsers };
}

export async function softDeleteUser(db, userId) {
  if (!userId) throw new Error('Missing userId');

  const userRef = db.collection('users').doc(userId);
  const doc = await userRef.get();

  if (!doc.exists) {
    throw new Error('User not found');
  }

  // Scrub PII for compliance
  await userRef.update({
    isActive: false,
    isDeleted: true,
    email: null,
    phoneNumber: null,
    preciseLocation: null,
    pushTokens: [],
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return { success: true };
}
