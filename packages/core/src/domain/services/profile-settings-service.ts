export type NotificationPreferenceKey =
  | 'pushNewMatches'
  | 'pushEventUpdates'
  | 'pushTicketReminders'
  | 'pushPromotions'
  | 'emailEventUpdates';

export type ProfileSettingsUpdate = {
  bio?: string | null;
  datingPhotos?: string[];
  photos?: string[];
  notificationPreferences?: Partial<Record<NotificationPreferenceKey, boolean>>;
  pushNewMatches?: boolean;
  pushEventUpdates?: boolean;
  displayName?: string | null;
  name?: string | null;
  firstName?: string | null;
  city?: string | null;
  photoURL?: string | null;
  avatar?: string | null;
  instagram?: string | null;
  spotify?: string | null;
  datingActive?: boolean;
};

const MAX_BIO_LENGTH = 500;
const MAX_DATING_PHOTOS = 5;
const ALLOWED_NOTIFICATION_KEYS: NotificationPreferenceKey[] = [
  'pushNewMatches',
  'pushEventUpdates',
  'pushTicketReminders',
  'pushPromotions',
  'emailEventUpdates',
];
const SAFE_STRING_FIELDS = [
  'displayName',
  'name',
  'firstName',
  'city',
  'photoURL',
  'avatar',
  'instagram',
  'spotify',
] as const;

function normalizeNullableString(value: unknown, maxLength = 160): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  return value.trim().slice(0, maxLength);
}

function normalizePhotoList(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return undefined;

  const seen = new Set<string>();
  const photos: string[] = [];

  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const photo = entry.trim();
    if (!photo || seen.has(photo)) continue;
    seen.add(photo);
    photos.push(photo);
    if (photos.length >= MAX_DATING_PHOTOS) break;
  }

  return photos;
}

function normalizeNotificationPreferences(
  updates: ProfileSettingsUpdate,
): Partial<Record<NotificationPreferenceKey, boolean>> | undefined {
  const next: Partial<Record<NotificationPreferenceKey, boolean>> = {};
  const nested = updates.notificationPreferences || {};

  for (const key of ALLOWED_NOTIFICATION_KEYS) {
    const value = nested[key] ?? updates[key as keyof ProfileSettingsUpdate];
    if (typeof value === 'boolean') next[key] = value;
  }

  return Object.keys(next).length ? next : undefined;
}

function buildSafeProfileSettingsUpdate(updates: ProfileSettingsUpdate): Record<string, unknown> {
  const safe: Record<string, unknown> = {};

  const bio = normalizeNullableString(updates.bio, MAX_BIO_LENGTH);
  if (bio !== undefined) safe.bio = bio;

  const datingPhotos = normalizePhotoList(updates.datingPhotos ?? updates.photos);
  if (datingPhotos !== undefined) {
    safe.datingPhotos = datingPhotos;
    safe.photos = datingPhotos;
  }

  for (const field of SAFE_STRING_FIELDS) {
    const value = normalizeNullableString(updates[field], 160);
    if (value !== undefined) safe[field] = value;
  }

  if (typeof updates.datingActive === 'boolean') safe.datingActive = updates.datingActive;

  const preferences = normalizeNotificationPreferences(updates);
  if (preferences) {
    safe.notificationPreferences = preferences;
    for (const [key, value] of Object.entries(preferences)) safe[key] = value;
  }

  safe.updatedAt = new Date().toISOString();
  return safe;
}

export async function updateUserProfileSettings(
  db: any,
  userId: string,
  updates: ProfileSettingsUpdate,
) {
  if (!db) throw new Error('Missing Firestore instance');
  if (!userId) throw new Error('Missing userId');

  const userRef = db.collection('users').doc(userId);
  const existing = await userRef.get();
  const safeUpdates = buildSafeProfileSettingsUpdate(updates);

  if (!existing.exists) {
    await userRef.set({
      uid: userId,
      isActive: true,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      ...safeUpdates,
    });
  } else {
    await userRef.set(safeUpdates, { merge: true });
  }

  const updatedDoc = await userRef.get();
  return { id: updatedDoc.id, ...updatedDoc.data() };
}
