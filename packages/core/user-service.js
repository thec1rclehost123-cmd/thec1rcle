export async function syncAuthUser(db, userId, authRecord) {
  if (!userId) throw new Error('Missing userId');

  const userRef = db.collection('users').doc(userId);
  const doc = await userRef.get();

  if (!doc.exists) {
    const baseline = {
      uid: userId,
      email: authRecord?.email || null,
      phoneNumber: authRecord?.phoneNumber || null,
      name: authRecord?.displayName || '',
      photoURL: authRecord?.photoURL || null,
      datingActive: false,
      isActive: true,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await userRef.set(baseline);
    return { id: userId, ...baseline, isNewUser: true };
  }

  return { id: doc.id, ...doc.data(), isNewUser: false };
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
