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
      phoneNumber: authRecord?.phoneNumber || null,
      name: authRecord?.displayName || '',
      displayName: authRecord?.displayName || '',
      photoURL: authRecord?.photoURL || null,
      avatar: authRecord?.photoURL || null,
      role: claims.role || DEFAULT_USER_ROLE,
      roles: claims.roles || [DEFAULT_USER_ROLE],
      datingActive: false,
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
    email: existing.email || authRecord?.email || null,
    phoneNumber: existing.phoneNumber || authRecord?.phoneNumber || null,
    displayName: existing.displayName || existing.name || authRecord?.displayName || '',
    name: existing.name || existing.displayName || authRecord?.displayName || '',
    photoURL: existing.photoURL || authRecord?.photoURL || null,
    avatar: existing.avatar || existing.photoURL || authRecord?.photoURL || null,
    role: existing.role || claims.role || DEFAULT_USER_ROLE,
    roles:
      Array.isArray(existing.roles) && existing.roles.length > 0 ? existing.roles : claims.roles,
    isActive: existing.isActive !== false,
    isDeleted: existing.isDeleted === true,
    updatedAt: now,
    lastLoginAt: now,
    lastAuthSyncAt: now,
  };

  await userRef.set(patch, { merge: true });
  return canonicalUserContract(userId, { ...existing, ...patch }, { isNewUser: false, claims });
}

export async function registerDeviceToken(db, userId, payload = {}) {
  if (!userId) throw new Error('Missing userId');
  const token = String(payload.token || '').trim();
  if (!token) throw new Error('Missing device token');

  const now = nowIso();
  const deviceId = String(payload.deviceId || token).slice(0, 180);
  const platform = String(payload.platform || 'unknown').slice(0, 40);
  const projectId = payload.projectId ? String(payload.projectId).slice(0, 120) : null;
  const appVersion = payload.appVersion ? String(payload.appVersion).slice(0, 80) : null;
  const installationId = payload.installationId
    ? String(payload.installationId).slice(0, 180)
    : null;

  const record = {
    id: deviceId,
    userId,
    token,
    provider: payload.provider || 'expo',
    platform,
    projectId,
    appVersion,
    installationId,
    isActive: true,
    updatedAt: now,
    lastSeenAt: now,
    createdAt: payload.createdAt || now,
  };

  const batch = db.batch();
  batch.set(db.collection('deviceTokens').doc(`${userId}_${deviceId}`), record, { merge: true });
  batch.set(
    db.collection('users').doc(userId),
    {
      pushToken: token,
      pushTokens: [token],
      lastTokenUpdate: now,
      updatedAt: now,
    },
    { merge: true },
  );
  await batch.commit();

  return { success: true, deviceToken: record };
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

  const safeUpdates = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };

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
