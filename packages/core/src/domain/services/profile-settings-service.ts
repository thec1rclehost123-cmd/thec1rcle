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
  settings?: {
    notifications?: Partial<Record<SettingsNotificationKey, boolean>>;
    privacy?: Partial<SettingsPrivacyUpdate>;
    appearance?: Partial<SettingsAppearanceUpdate>;
    updatedAt?: string;
  };
};

type SettingsNotificationKey =
  | 'tickets'
  | 'events'
  | 'chat'
  | 'dm'
  | 'promo'
  | 'allowAlerts'
  | 'smsTransactional'
  | 'marketingPromotions';

type SettingsPrivacyUpdate = {
  dmPrivacy: 'anyone' | 'event' | 'contacts' | 'none';
  showOnlineStatus: boolean;
  showLastSeen: boolean;
  publicProfile: boolean;
  showOnGuestlists: boolean;
  showEventsAttending: boolean;
};

type SettingsAppearanceUpdate = {
  theme: 'system' | 'light' | 'dark';
  reduceMotion: boolean;
  haptics: boolean;
};

type SettingsNotificationUpdate = Partial<Record<SettingsNotificationKey, boolean>>;
type SettingsPrivacyPartialUpdate = Partial<SettingsPrivacyUpdate>;
type SettingsAppearancePartialUpdate = Partial<SettingsAppearanceUpdate>;

const MAX_BIO_LENGTH = 500;
const MAX_DATING_PHOTOS = 5;
function normalizeSettingsNotifications(
  value: SettingsNotificationUpdate | undefined,
): SettingsNotificationUpdate | undefined {
  if (!value || typeof value !== 'object') return undefined;

  const notifications: Partial<Record<SettingsNotificationKey, boolean>> = {};
  if (typeof value.tickets === 'boolean') notifications.tickets = value.tickets;
  if (typeof value.events === 'boolean') notifications.events = value.events;
  if (typeof value.chat === 'boolean') notifications.chat = value.chat;
  if (typeof value.dm === 'boolean') notifications.dm = value.dm;
  if (typeof value.promo === 'boolean') notifications.promo = value.promo;
  if (typeof value.allowAlerts === 'boolean') notifications.allowAlerts = value.allowAlerts;
  if (typeof value.smsTransactional === 'boolean') {
    notifications.smsTransactional = value.smsTransactional;
  }
  if (typeof value.marketingPromotions === 'boolean') {
    notifications.marketingPromotions = value.marketingPromotions;
  }

  return Object.keys(notifications).length ? notifications : undefined;
}

function normalizeSettingsPrivacy(
  value: SettingsPrivacyPartialUpdate | undefined,
): SettingsPrivacyPartialUpdate | undefined {
  if (!value || typeof value !== 'object') return undefined;

  const privacy: Partial<SettingsPrivacyUpdate> = {};
  if (
    value.dmPrivacy === 'anyone' ||
    value.dmPrivacy === 'event' ||
    value.dmPrivacy === 'contacts' ||
    value.dmPrivacy === 'none'
  ) {
    privacy.dmPrivacy = value.dmPrivacy;
  }
  if (typeof value.showOnlineStatus === 'boolean')
    privacy.showOnlineStatus = value.showOnlineStatus;
  if (typeof value.showLastSeen === 'boolean') privacy.showLastSeen = value.showLastSeen;
  if (typeof value.publicProfile === 'boolean') privacy.publicProfile = value.publicProfile;
  if (typeof value.showOnGuestlists === 'boolean')
    privacy.showOnGuestlists = value.showOnGuestlists;
  if (typeof value.showEventsAttending === 'boolean') {
    privacy.showEventsAttending = value.showEventsAttending;
  }

  return Object.keys(privacy).length ? privacy : undefined;
}

function normalizeSettingsAppearance(
  value: SettingsAppearancePartialUpdate | undefined,
): SettingsAppearancePartialUpdate | undefined {
  if (!value || typeof value !== 'object') return undefined;

  const appearance: Partial<SettingsAppearanceUpdate> = {};
  if (value.theme === 'system' || value.theme === 'light' || value.theme === 'dark') {
    appearance.theme = value.theme;
  }
  if (typeof value.reduceMotion === 'boolean') appearance.reduceMotion = value.reduceMotion;
  if (typeof value.haptics === 'boolean') appearance.haptics = value.haptics;

  return Object.keys(appearance).length ? appearance : undefined;
}

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

  const pushNewMatches = nested.pushNewMatches ?? updates.pushNewMatches;
  if (typeof pushNewMatches === 'boolean') next.pushNewMatches = pushNewMatches;

  const pushEventUpdates = nested.pushEventUpdates ?? updates.pushEventUpdates;
  if (typeof pushEventUpdates === 'boolean') next.pushEventUpdates = pushEventUpdates;

  const pushTicketReminders = nested.pushTicketReminders;
  if (typeof pushTicketReminders === 'boolean') {
    next.pushTicketReminders = pushTicketReminders;
  }

  const pushPromotions = nested.pushPromotions;
  if (typeof pushPromotions === 'boolean') next.pushPromotions = pushPromotions;

  const emailEventUpdates = nested.emailEventUpdates;
  if (typeof emailEventUpdates === 'boolean') {
    next.emailEventUpdates = emailEventUpdates;
  }

  return Object.keys(next).length ? next : undefined;
}

function normalizeNestedSettings(value: ProfileSettingsUpdate['settings']) {
  if (!value || typeof value !== 'object') return undefined;
  const settings: Record<string, unknown> = {};

  const notifications = normalizeSettingsNotifications(value.notifications);
  if (notifications) settings.notifications = notifications;

  const privacy = normalizeSettingsPrivacy(value.privacy);
  if (privacy) settings.privacy = privacy;

  const appearance = normalizeSettingsAppearance(value.appearance);
  if (appearance) settings.appearance = appearance;

  settings.updatedAt = new Date().toISOString();
  return Object.keys(settings).length > 1 ? settings : undefined;
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

  const displayName = normalizeNullableString(updates.displayName, 160);
  if (displayName !== undefined) safe.displayName = displayName;

  const name = normalizeNullableString(updates.name, 160);
  if (name !== undefined) safe.name = name;

  const firstName = normalizeNullableString(updates.firstName, 160);
  if (firstName !== undefined) safe.firstName = firstName;

  const city = normalizeNullableString(updates.city, 160);
  if (city !== undefined) safe.city = city;

  const photoURL = normalizeNullableString(updates.photoURL, 160);
  if (photoURL !== undefined) safe.photoURL = photoURL;

  const avatar = normalizeNullableString(updates.avatar, 160);
  if (avatar !== undefined) safe.avatar = avatar;

  const instagram = normalizeNullableString(updates.instagram, 160);
  if (instagram !== undefined) safe.instagram = instagram;

  const spotify = normalizeNullableString(updates.spotify, 160);
  if (spotify !== undefined) safe.spotify = spotify;

  if (typeof updates.datingActive === 'boolean') safe.datingActive = updates.datingActive;

  const nestedSettings = normalizeNestedSettings(updates.settings);
  if (nestedSettings) safe.settings = nestedSettings;

  const preferences = normalizeNotificationPreferences(updates);
  if (preferences) {
    safe.notificationPreferences = preferences;
    if (typeof preferences.pushNewMatches === 'boolean') {
      safe.pushNewMatches = preferences.pushNewMatches;
    }
    if (typeof preferences.pushEventUpdates === 'boolean') {
      safe.pushEventUpdates = preferences.pushEventUpdates;
    }
    if (typeof preferences.pushTicketReminders === 'boolean') {
      safe.pushTicketReminders = preferences.pushTicketReminders;
    }
    if (typeof preferences.pushPromotions === 'boolean') {
      safe.pushPromotions = preferences.pushPromotions;
    }
    if (typeof preferences.emailEventUpdates === 'boolean') {
      safe.emailEventUpdates = preferences.emailEventUpdates;
    }
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
