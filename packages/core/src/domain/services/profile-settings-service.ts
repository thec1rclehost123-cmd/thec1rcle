export type NotificationPreferenceKey =
  | 'pushNewMatches'
  | 'pushEventUpdates'
  | 'pushTicketReminders'
  | 'pushPromotions'
  | 'emailEventUpdates';

export type DatingVitals = {
  height?: string | null;
  gender?: string | null;
  location?: string | null;
};

export type ProfileAnthem = {
  trackId?: string;
  trackName: string;
  artistName: string;
  artworkUrl?: string | null;
  previewUrl?: string | null;
  source?: 'itunes' | 'spotify';
  externalUrl?: string | null;
};

export type ProfileSettingsUpdate = {
  gender?: string | null;
  bio?: string | null;
  datingPhotos?: string[];
  datingVitals?: DatingVitals;
  anthem?: ProfileAnthem | null;
  photos?: string[];
  vibeTags?: string[];
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
  basicSetupComplete?: boolean;
  profileSetupComplete?: boolean;
  profileComplete?: boolean;
  onboardingComplete?: boolean;
  socialSetupComplete?: boolean;
  notifications?: Partial<Record<SettingsNotificationKey, boolean>>;
  privacy?: Partial<SettingsPrivacyUpdate>;
  appearance?: Partial<SettingsAppearanceUpdate>;
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
  | 'marketingPromotions'
  | 'eventInvites'
  | 'eventReminders'
  | 'eventBlasts'
  | 'eventUpdates'
  | 'feedbackRequests'
  | 'guestRegistrations'
  | 'feedbackResponses'
  | 'newMembers'
  | 'eventSubmissions';

type SettingsPrivacyUpdate = {
  dmPrivacy: 'anyone' | 'event' | 'contacts' | 'none';
  showOnlineStatus: boolean;
  showLastSeen: boolean;
  publicProfile: boolean;
  showOnGuestlists: boolean;
  showEventsAttending: boolean;
  contactsSyncing: boolean;
  locationAccess: boolean;
};

type SettingsAppearanceUpdate = {
  theme: 'system' | 'light' | 'dark';
  reduceMotion: boolean;
  haptics: boolean;
};

type UserSettings = {
  notifications: Record<SettingsNotificationKey, boolean>;
  privacy: SettingsPrivacyUpdate;
  appearance: SettingsAppearanceUpdate;
  updatedAt: string | null;
};

type SettingsNotificationUpdate = Partial<Record<SettingsNotificationKey, boolean>>;
type SettingsPrivacyPartialUpdate = Partial<SettingsPrivacyUpdate>;
type SettingsAppearancePartialUpdate = Partial<SettingsAppearanceUpdate>;
type SettingsPatch = {
  notifications?: SettingsNotificationUpdate;
  privacy?: SettingsPrivacyPartialUpdate;
  appearance?: SettingsAppearancePartialUpdate;
};

const MAX_BIO_LENGTH = 500;
const MAX_DATING_PHOTOS = 6;
const MAX_VIBE_TAGS = 20;
const GENDER_CHANGE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
const VALID_GENDERS = new Set(['male', 'female', 'other', 'prefer_not_to_say']);
const PROFILE_FLOW_FLAG_KEYS = [
  'basicSetupComplete',
  'profileSetupComplete',
  'profileComplete',
  'onboardingComplete',
  'socialSetupComplete',
] as const;

const DEFAULT_USER_SETTINGS: UserSettings = {
  notifications: {
    tickets: true,
    events: true,
    chat: true,
    dm: true,
    promo: false,
    allowAlerts: true,
    smsTransactional: true,
    marketingPromotions: true,
    eventInvites: true,
    eventReminders: true,
    eventBlasts: false,
    eventUpdates: true,
    feedbackRequests: true,
    guestRegistrations: true,
    feedbackResponses: true,
    newMembers: true,
    eventSubmissions: true,
  },
  privacy: {
    dmPrivacy: 'event',
    showOnlineStatus: true,
    showLastSeen: true,
    publicProfile: true,
    showOnGuestlists: true,
    showEventsAttending: true,
    contactsSyncing: false,
    locationAccess: false,
  },
  appearance: {
    theme: 'dark',
    reduceMotion: false,
    haptics: true,
  },
  updatedAt: null,
};

function cloneDefaultSettings(): UserSettings {
  return {
    notifications: { ...DEFAULT_USER_SETTINGS.notifications },
    privacy: { ...DEFAULT_USER_SETTINGS.privacy },
    appearance: { ...DEFAULT_USER_SETTINGS.appearance },
    updatedAt: DEFAULT_USER_SETTINGS.updatedAt,
  };
}

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
  if (typeof value.eventInvites === 'boolean') notifications.eventInvites = value.eventInvites;
  if (typeof value.eventReminders === 'boolean') {
    notifications.eventReminders = value.eventReminders;
  }
  if (typeof value.eventBlasts === 'boolean') notifications.eventBlasts = value.eventBlasts;
  if (typeof value.eventUpdates === 'boolean') notifications.eventUpdates = value.eventUpdates;
  if (typeof value.feedbackRequests === 'boolean') {
    notifications.feedbackRequests = value.feedbackRequests;
  }
  if (typeof value.guestRegistrations === 'boolean') {
    notifications.guestRegistrations = value.guestRegistrations;
  }
  if (typeof value.feedbackResponses === 'boolean') {
    notifications.feedbackResponses = value.feedbackResponses;
  }
  if (typeof value.newMembers === 'boolean') notifications.newMembers = value.newMembers;
  if (typeof value.eventSubmissions === 'boolean') {
    notifications.eventSubmissions = value.eventSubmissions;
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
  if (typeof value.contactsSyncing === 'boolean') privacy.contactsSyncing = value.contactsSyncing;
  if (typeof value.locationAccess === 'boolean') privacy.locationAccess = value.locationAccess;

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

function normalizeVibeTags(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return undefined;

  const seen = new Set<string>();
  const tags: string[] = [];

  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const tag = entry.trim().slice(0, 60);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= MAX_VIBE_TAGS) break;
  }

  return tags;
}

function normalizeDatingVitals(value: unknown): DatingVitals | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object') return undefined;

  const raw = value as Record<string, unknown>;
  const vitals: DatingVitals = {};

  const height = normalizeNullableString(raw.height, 40);
  if (height !== undefined) vitals.height = height;

  const gender = normalizeNullableString(raw.gender, 80);
  if (gender !== undefined) vitals.gender = gender;

  const location = normalizeNullableString(raw.location, 120);
  if (location !== undefined) vitals.location = location;

  return Object.keys(vitals).length ? vitals : undefined;
}

function normalizeProfileAnthem(value: unknown): ProfileAnthem | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!value || typeof value !== 'object') return undefined;

  const raw = value as Record<string, unknown>;
  const trackName = normalizeNullableString(raw.trackName, 180);
  const artistName = normalizeNullableString(raw.artistName, 180);
  if (!trackName || !artistName) return undefined;

  const trackId = normalizeNullableString(raw.trackId, 120);
  const artworkUrl = normalizeNullableString(raw.artworkUrl, 500);
  const previewUrl = normalizeNullableString(raw.previewUrl, 500);
  const externalUrl = normalizeNullableString(raw.externalUrl, 500);

  const anthem: ProfileAnthem = {
    trackName,
    artistName,
  };
  if (trackId !== undefined && trackId !== null) anthem.trackId = trackId;
  if (artworkUrl !== undefined) anthem.artworkUrl = artworkUrl;
  if (previewUrl !== undefined) anthem.previewUrl = previewUrl;
  if (raw.source === 'itunes' || raw.source === 'spotify') anthem.source = raw.source;
  if (externalUrl !== undefined) anthem.externalUrl = externalUrl;

  return anthem;
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

function normalizeSettingsPatch(value: ProfileSettingsUpdate['settings'] | ProfileSettingsUpdate) {
  if (!value || typeof value !== 'object') return undefined;
  const settings: SettingsPatch = {};

  const notifications = normalizeSettingsNotifications(value.notifications);
  if (notifications) settings.notifications = notifications;

  const privacy = normalizeSettingsPrivacy(value.privacy);
  if (privacy) settings.privacy = privacy;

  const appearance = normalizeSettingsAppearance(value.appearance);
  if (appearance) settings.appearance = appearance;

  return Object.keys(settings).length ? settings : undefined;
}

function mergeSettingsPatch(base: SettingsPatch, patch: SettingsPatch | undefined): SettingsPatch {
  if (!patch) return base;
  if (patch.notifications) {
    base.notifications = { ...(base.notifications || {}), ...patch.notifications };
  }
  if (patch.privacy) {
    base.privacy = { ...(base.privacy || {}), ...patch.privacy };
  }
  if (patch.appearance) {
    base.appearance = { ...(base.appearance || {}), ...patch.appearance };
  }
  return base;
}

function collectSettingsPatch(updates: ProfileSettingsUpdate): SettingsPatch | undefined {
  const patch = mergeSettingsPatch({}, normalizeSettingsPatch(updates.settings));
  mergeSettingsPatch(patch, normalizeSettingsPatch(updates));
  return Object.keys(patch).length ? patch : undefined;
}

function normalizeStoredUserSettings(value: unknown): UserSettings {
  const settings = cloneDefaultSettings();
  if (!value || typeof value !== 'object') return settings;

  const stored = value as NonNullable<ProfileSettingsUpdate['settings']>;
  const patch = normalizeSettingsPatch(stored);
  if (patch?.notifications) {
    settings.notifications = { ...settings.notifications, ...patch.notifications };
  }
  if (patch?.privacy) {
    settings.privacy = { ...settings.privacy, ...patch.privacy };
  }
  if (patch?.appearance) {
    settings.appearance = { ...settings.appearance, ...patch.appearance };
  }
  if (typeof stored.updatedAt === 'string') settings.updatedAt = stored.updatedAt;

  return settings;
}

function buildMergedUserSettings(existingSettings: unknown, patch: SettingsPatch): UserSettings {
  const settings = normalizeStoredUserSettings(existingSettings);
  if (patch.notifications) {
    settings.notifications = { ...settings.notifications, ...patch.notifications };
  }
  if (patch.privacy) {
    settings.privacy = { ...settings.privacy, ...patch.privacy };
  }
  if (patch.appearance) {
    settings.appearance = { ...settings.appearance, ...patch.appearance };
  }
  settings.updatedAt = new Date().toISOString();
  return settings;
}

export function buildSafeProfileSettingsUpdate(
  updates: ProfileSettingsUpdate,
  existingData: Record<string, unknown> = {},
  now = new Date().toISOString(),
): { safeUpdates: Record<string, unknown>; error?: string; statusCode?: number } {
  const safe: Record<string, unknown> = {};

  const bio = normalizeNullableString(updates.bio, MAX_BIO_LENGTH);
  if (bio !== undefined) safe.bio = bio;

  const datingPhotos = normalizePhotoList(updates.datingPhotos ?? updates.photos);
  if (datingPhotos !== undefined) {
    safe.datingPhotos = datingPhotos;
    safe.photos = datingPhotos;
  }

  const vibeTags = normalizeVibeTags(updates.vibeTags);
  if (vibeTags !== undefined) safe.vibeTags = vibeTags;

  const datingVitals = normalizeDatingVitals(updates.datingVitals);
  if (datingVitals !== undefined) safe.datingVitals = datingVitals;

  const anthem = normalizeProfileAnthem(updates.anthem);
  if (anthem !== undefined) safe.anthem = anthem;

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

  if (updates.gender !== undefined) {
    if (updates.gender !== null && !VALID_GENDERS.has(updates.gender)) {
      return {
        safeUpdates: {},
        error: 'Invalid gender value',
        statusCode: 400,
      };
    }

    const existingGender = existingData.gender as string | undefined;
    if (existingGender && existingGender !== updates.gender) {
      const lastChangedAt = existingData.genderLastChangedAt
        ? new Date(existingData.genderLastChangedAt as string).getTime()
        : 0;
      const msSinceChange = new Date(now).getTime() - lastChangedAt;

      if (msSinceChange < GENDER_CHANGE_COOLDOWN_MS) {
        const daysLeft = Math.ceil(
          (GENDER_CHANGE_COOLDOWN_MS - msSinceChange) / (24 * 60 * 60 * 1000),
        );
        return {
          safeUpdates: {},
          error: `Gender can only be changed once every 30 days. Please try again in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`,
          statusCode: 429,
        };
      }

      safe.genderLastChangedAt = now;
    } else if (!existingGender) {
      safe.genderLastChangedAt = now;
    }

    safe.gender = updates.gender;
  }

  if (typeof updates.datingActive === 'boolean') safe.datingActive = updates.datingActive;

  for (const key of PROFILE_FLOW_FLAG_KEYS) {
    if (typeof updates[key] === 'boolean') safe[key] = updates[key];
  }

  const settingsPatch = collectSettingsPatch(updates);
  if (settingsPatch) safe.settings = buildMergedUserSettings(existingData.settings, settingsPatch);

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

  safe.updatedAt = now;
  return { safeUpdates: safe };
}

export async function updateUserProfileSettings(
  db: any,
  userId: string,
  updates: ProfileSettingsUpdate,
) {
  if (!db) throw new Error('Missing Firestore instance');
  if (!userId) throw new Error('Missing userId');

  const userRef = db.collection('users').doc(userId);
  
  return await db.runTransaction(async (transaction: any) => {
    const existing = await transaction.get(userRef);
    const existingData = existing.exists ? existing.data() || {} : {};
    const result = buildSafeProfileSettingsUpdate(updates, existingData);

    if (result.error) {
      const err = new Error(result.error) as any;
      err.code = result.statusCode === 429 ? 'PROFILE_UPDATE_COOLDOWN' : 'UPDATE_FAILED';
      err.statusCode = result.statusCode || 400;
      throw err;
    }

    if (!existing.exists) {
      const newData = {
        uid: userId,
        isActive: true,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        ...result.safeUpdates,
      };
      transaction.set(userRef, newData);
      return { id: userRef.id, ...newData };
    } else {
      transaction.set(userRef, result.safeUpdates, { merge: true });
      return { id: userRef.id, ...existingData, ...result.safeUpdates };
    }
  });
}

export async function getUserSettings(db: any, userId: string): Promise<UserSettings> {
  if (!db) throw new Error('Missing Firestore instance');
  if (!userId) throw new Error('Missing userId');

  const doc = await db.collection('users').doc(userId).get();
  if (!doc.exists) {
    return cloneDefaultSettings();
  }

  return normalizeStoredUserSettings(doc.data()?.settings);
}
