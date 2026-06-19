type DeleteStats = {
  authDeleted: boolean;
  userDocumentDeleted: boolean;
  userLikesDeleted: number;
  userPassesDeleted: number;
  userFollowsDeleted: number;
  userEventInterestsDeleted: number;
  eventInterestMirrorsDeleted: number;
  eventGroupChatMembershipsDeleted: number;
  notificationsDeleted: number;
  ticketsDeleted: number;
  ordersDeleted: number;
  venueFollowerMirrorsDeleted: number;
  storageObjectsDeleted: number;
};

const DELETE_BATCH_SIZE = 400;
const USER_PHOTO_FIELDS = ['photoURL', 'avatar', 'profileImage', 'datingPhotos', 'photos'];

async function deleteQuerySnapshot(db: any, query: any): Promise<number> {
  let deleted = 0;

  while (true) {
    const snap = await query.limit(DELETE_BATCH_SIZE).get();
    if (snap.empty) return deleted;

    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
      deleted += 1;
    }
    await batch.commit();

    if (snap.size < DELETE_BATCH_SIZE) return deleted;
  }
}

async function deleteCollection(db: any, collectionRef: any): Promise<number> {
  return deleteQuerySnapshot(db, collectionRef);
}

function pushPhotoValues(value: unknown, target: string[]) {
  if (typeof value === 'string' && value.trim()) {
    target.push(value.trim());
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) pushPhotoValues(entry, target);
  }
}

function storagePathFromUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    const encodedPath = parsed.pathname.includes('/o/')
      ? parsed.pathname.split('/o/')[1]
      : parsed.pathname.split('/').slice(2).join('/');
    if (!encodedPath) return null;
    return decodeURIComponent(encodedPath.split('?')[0]).replace(/^\/+/, '');
  } catch {
    return value.includes('/') && !value.startsWith('http') ? value.replace(/^\/+/, '') : null;
  }
}

async function deleteStorageObject(bucket: any, pathOrUrl: string): Promise<number> {
  const path = storagePathFromUrl(pathOrUrl);
  if (!path) return 0;

  try {
    await bucket.file(path).delete({ ignoreNotFound: true });
    return 1;
  } catch {
    return 0;
  }
}

async function deleteStoragePrefix(bucket: any, prefix: string): Promise<number> {
  try {
    const [, , response] = await bucket.deleteFiles({ prefix, force: true });
    const deleted = Number(response?.deleted?.length || 0);
    return Number.isFinite(deleted) ? deleted : 0;
  } catch {
    return 0;
  }
}

async function deleteUserStorage(storage: any, uid: string, userData: Record<string, unknown>) {
  if (!storage?.bucket) return 0;

  const bucket = storage.bucket();
  const photoPaths: string[] = [];
  for (const field of USER_PHOTO_FIELDS) pushPhotoValues(userData[field], photoPaths);

  const prefixes = [
    `avatars/${uid}`,
    `avatars/${uid}/`,
    `users/${uid}/`,
    `profile_photos/${uid}`,
    `profilePhotos/${uid}`,
    `social_photos/${uid}`,
  ];

  const [prefixDeleted, objectDeleted] = await Promise.all([
    Promise.all(prefixes.map((prefix) => deleteStoragePrefix(bucket, prefix))),
    Promise.all([...new Set(photoPaths)].map((path) => deleteStorageObject(bucket, path))),
  ]);

  return [...prefixDeleted, ...objectDeleted].reduce((sum, value) => sum + value, 0);
}

async function deleteUserFollows(db: any, uid: string): Promise<number> {
  const userFollowsRef = db.collection('userFollows').doc(uid);
  const [venuesDeleted, hostsDeleted] = await Promise.all([
    deleteCollection(db, userFollowsRef.collection('venues')),
    deleteCollection(db, userFollowsRef.collection('hosts')),
  ]);
  await userFollowsRef.delete().catch(() => {});
  return venuesDeleted + hostsDeleted;
}

async function deleteVenueFollowerMirrors(db: any, uid: string): Promise<number> {
  if (typeof db.collectionGroup !== 'function') return 0;
  const mirrors = db.collectionGroup('followers').where('userId', '==', uid);
  return deleteQuerySnapshot(db, mirrors);
}

async function deleteUserEventInterests(db: any, uid: string): Promise<number> {
  const userInterestsRef = db.collection('userEventInterests').doc(uid);
  const eventsDeleted = await deleteCollection(db, userInterestsRef.collection('events'));
  await userInterestsRef.delete().catch(() => {});
  return eventsDeleted;
}

async function deleteCollectionGroupByUserId(
  db: any,
  collectionId: string,
  uid: string,
): Promise<number> {
  if (typeof db.collectionGroup !== 'function') return 0;
  return deleteQuerySnapshot(db, db.collectionGroup(collectionId).where('userId', '==', uid));
}

export async function deleteUserAccountCascade(input: {
  db: any;
  auth: any;
  storage?: any;
  uid: string;
}): Promise<DeleteStats> {
  const { db, auth, storage, uid } = input;
  if (!db) throw new Error('Missing Firestore instance');
  if (!auth) throw new Error('Missing Firebase Auth instance');
  if (!uid) throw new Error('Missing uid');

  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();
  const userData = userDoc.exists ? userDoc.data() || {} : {};

  const [
    userLikesFrom,
    userLikesTo,
    userPassesFrom,
    userPassesTo,
    userFollows,
    mirrorFollows,
    userEventInterests,
    eventInterestMirrors,
    eventGroupChatMemberships,
    notificationsByTarget,
    notificationsByUser,
    tickets,
    orders,
    rsvpOrders,
  ] = await Promise.all([
    deleteQuerySnapshot(db, db.collection('userLikes').where('fromUserId', '==', uid)),
    deleteQuerySnapshot(db, db.collection('userLikes').where('toUserId', '==', uid)),
    deleteQuerySnapshot(db, db.collection('userPasses').where('fromUserId', '==', uid)),
    deleteQuerySnapshot(db, db.collection('userPasses').where('toUserId', '==', uid)),
    deleteUserFollows(db, uid),
    deleteVenueFollowerMirrors(db, uid),
    deleteUserEventInterests(db, uid),
    deleteCollectionGroupByUserId(db, 'interestedUsers', uid),
    deleteCollectionGroupByUserId(db, 'members', uid),
    deleteQuerySnapshot(db, db.collection('notifications').where('targetId', '==', uid)),
    deleteQuerySnapshot(db, db.collection('notifications').where('userId', '==', uid)),
    deleteQuerySnapshot(db, db.collection('tickets').where('userId', '==', uid)),
    deleteQuerySnapshot(db, db.collection('orders').where('userId', '==', uid)),
    deleteQuerySnapshot(db, db.collection('rsvp_orders').where('userId', '==', uid)),
  ]);

  const storageObjectsDeleted = await deleteUserStorage(storage, uid, userData);

  let authDeleted = false;
  try {
    await auth.deleteUser(uid);
    authDeleted = true;
  } catch (error: unknown) {
    if ((error as any)?.code === 'auth/user-not-found') {
      authDeleted = false;
    } else {
      throw error;
    }
  }

  await userRef.delete();

  return {
    authDeleted,
    userDocumentDeleted: userDoc.exists,
    userLikesDeleted: userLikesFrom + userLikesTo,
    userPassesDeleted: userPassesFrom + userPassesTo,
    userFollowsDeleted: userFollows,
    userEventInterestsDeleted: userEventInterests,
    eventInterestMirrorsDeleted: eventInterestMirrors,
    eventGroupChatMembershipsDeleted: eventGroupChatMemberships,
    notificationsDeleted: notificationsByTarget + notificationsByUser,
    ticketsDeleted: tickets,
    ordersDeleted: orders + rsvpOrders,
    venueFollowerMirrorsDeleted: mirrorFollows,
    storageObjectsDeleted,
  };
}
