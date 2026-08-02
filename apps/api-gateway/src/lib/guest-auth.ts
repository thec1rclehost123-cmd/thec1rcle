const GENDER_CHANGE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

export const GUEST_PHONE_REGEX = /^(\+91)?\d{10}$/;

const GUEST_PROFILE_UPDATE_FIELDS = new Set([
  'displayName',
  'photoURL',
  'avatar',
  'phone',
  'phoneNumber',
  'city',
  'instagram',
  'age',
  'gender',
  'bio',
  'handle',
  'username',
  'onboardingComplete',
  'attendedEvents',
  'savedEvents',
  'role',
  'venueId',
  'partnerId',
  'onboardingStatus',
]);

function asNullableString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value);
  return text.length ? text : null;
}

function asString(value: unknown, fallback = ''): string {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function asIsoString(value: any): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  return String(value);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(Boolean).map(String) : [];
}

function normalizeAvatarFields(input: Record<string, any>) {
  const photoURL = input.photoURL || input.avatar || null;
  const avatar = input.avatar || input.photoURL || null;
  return { photoURL, avatar };
}

export function getGuestOnboardingState(profile: Record<string, any> | null | undefined) {
  const onboardingComplete = profile?.onboardingComplete === true;

  return {
    onboardingComplete,
    state: onboardingComplete ? 'complete' : 'needs_onboarding',
  } as const;
}

export function normalizeGuestProfile(
  raw: Record<string, any> | null | undefined,
  fallback: Record<string, any> = {},
) {
  if (!raw) return null;

  const merged = { ...fallback, ...raw };
  const { photoURL, avatar } = normalizeAvatarFields(merged);

  return {
    uid: asString(merged.uid || fallback.uid),
    email: asString(merged.email || fallback.email),
    displayName: asString(merged.displayName || fallback.displayName || 'Member'),
    photoURL,
    avatar,
    phone: asNullableString(merged.phone ?? merged.phoneNumber),
    city: asString(merged.city),
    instagram: asString(merged.instagram),
    age: merged.age ?? null,
    gender: asNullableString(merged.gender),
    onboardingComplete: merged.onboardingComplete === true,
    hostStatus: asNullableString(merged.hostStatus),
    attendedEvents: asStringArray(merged.attendedEvents),
    createdAt: asIsoString(merged.createdAt),
    updatedAt: asIsoString(merged.updatedAt),
    role: asNullableString(merged.role),
    venueId: asNullableString(merged.venueId),
    partnerId: asNullableString(merged.partnerId),
    onboardingStatus: asNullableString(merged.onboardingStatus),
    isApproved: merged.isApproved === true,
    isBanned: merged.isBanned === true,
    // Partner onboarding fields
    contactPerson: asNullableString(merged.contactPerson),
    area: asNullableString(merged.area),
    website: asNullableString(merged.website),
    capacity: asNullableString(merged.capacity),
    plan: asNullableString(merged.plan),
    association: asNullableString(merged.association),
    associatedHostId: asNullableString(merged.associatedHostId),
    instagramHandle: asNullableString(merged.instagramHandle),
    bio: asNullableString(merged.bio),
    upcomingEventsText: asNullableString(merged.upcomingEventsText),
    pastEventsText: asNullableString(merged.pastEventsText),
    businessType: asNullableString(merged.businessType),
    registrationNumber: asNullableString(merged.registrationNumber),
    onboardingStep: asNullableString(merged.onboardingStep),
    entityType: asNullableString(merged.entityType ?? merged.onboardingEntityType),
    onboardingEntityType: asNullableString(merged.onboardingEntityType ?? merged.entityType),
    onboardingRole: asNullableString(merged.onboardingRole ?? merged.role),
    mustChangePassword: merged.mustChangePassword === true,
  };
}

export function buildGuestAuthBootstrap({
  user,
  rawProfile,
  onboardingRequest = null,
  unreadNotificationCount = 0,
  activeMembership = null,
}: {
  user: Record<string, any>;
  rawProfile?: Record<string, any> | null;
  onboardingRequest?: Record<string, any> | null;
  unreadNotificationCount?: number;
  activeMembership?: Record<string, any> | null;
}) {
  const identity = {
    uid: String(user.uid),
    email: user.email ? String(user.email) : null,
    displayName: user.name || user.displayName || null,
    photoURL: user.picture || user.photoURL || null,
    phoneNumber: user.phone_number || user.phoneNumber || null,
    providerId: user.firebase?.sign_in_provider || user.providerId || null,
    emailVerified: user.email_verified === true || user.emailVerified === true,
  };

  const profileFallback = {
    uid: identity.uid,
    email: identity.email,
    displayName: identity.displayName,
    photoURL: identity.photoURL,
    phone: identity.phoneNumber,
  };
  const profile = normalizeGuestProfile(rawProfile || profileFallback, profileFallback);
  const onboarding = getGuestOnboardingState(profile);
  const hostStatus = profile?.hostStatus || null;

  return {
    identity,
    user: {
      ...identity,
      ...(profile || {}),
      ...(activeMembership ? { activeMembership } : {}),
    },
    profile,
    onboarding: {
      onboardingComplete: onboarding.onboardingComplete,
      state: onboarding.state,
      hostStatus,
      onboardingRequest,
    },
    shell: {
      unreadNotificationCount,
      hasUnreadNotifications: unreadNotificationCount > 0,
    },
    routeAccess: {
      isAuthenticated: true,
      canAccessProfile: Boolean(identity.uid),
      shouldRedirectFromAuthPages: Boolean(identity.uid) && onboarding.onboardingComplete,
      requiresOnboarding: Boolean(identity.uid) && !onboarding.onboardingComplete,
      profilePath: identity.uid ? `/profile/${identity.uid}` : null,
    },
  };
}

export function buildGuestProfileCreatePayload(
  body: Record<string, any>,
  user: Record<string, any>,
  now = new Date().toISOString(),
) {
  const uid = String(user.uid);
  const email = String(body.email || user.email || '');
  const displayName = asString(
    body.displayName || body.name || user.name || user.displayName || 'Member',
  );
  const { photoURL, avatar } = normalizeAvatarFields({
    photoURL: body.photoURL || user.picture || user.photoURL,
    avatar: body.avatar,
  });

  let phone = body.phone || body.phoneNumber || user.phone_number || null;
  if (phone) {
    const trimmed = String(phone).trim();
    if (/^\d{10}$/.test(trimmed)) {
      phone = `+91${trimmed}`;
    } else if (/^\+91\d{10}$/.test(trimmed)) {
      phone = trimmed;
    }
  }

  return {
    uid,
    email,
    displayName,
    photoURL: photoURL || '',
    avatar: avatar || '',
    phone,
    city: body.city || '',
    instagram: body.instagram || '',
    age: body.age ?? null,
    gender: body.gender ?? null,
    attendedEvents: asStringArray(body.attendedEvents),
    isVerified: body.isVerified ?? true,
    onboardingComplete: body.onboardingComplete === true,
    createdAt: body.createdAt || now,
    updatedAt: body.updatedAt || now,
  };
}

export function buildGuestProfileUpdates(
  updates: Record<string, any>,
  existing: Record<string, any> = {},
  now = new Date().toISOString(),
) {
  const safeUpdates: Record<string, any> = {};

  for (const [field, value] of Object.entries(updates || {})) {
    if (GUEST_PROFILE_UPDATE_FIELDS.has(field)) {
      safeUpdates[field] = value;
    }
  }

  if (safeUpdates.phoneNumber !== undefined && safeUpdates.phone === undefined) {
    safeUpdates.phone = safeUpdates.phoneNumber;
  }

  if (safeUpdates.phone !== undefined) {
    let trimmedPhone = String(safeUpdates.phone).trim();

    if (trimmedPhone && !GUEST_PHONE_REGEX.test(trimmedPhone)) {
      return {
        safeUpdates: {},
        error: 'Phone number must contain exactly 10 digits, optionally prefixed with +91.',
        statusCode: 400,
      };
    }

    if (trimmedPhone) {
      if (/^\d{10}$/.test(trimmedPhone)) {
        trimmedPhone = `+91${trimmedPhone}`;
      }
      safeUpdates.phone = trimmedPhone;
      safeUpdates.phoneNumber = trimmedPhone;
    } else {
      safeUpdates.phone = '';
      safeUpdates.phoneNumber = '';
    }
  }

  if (safeUpdates.photoURL !== undefined && safeUpdates.avatar === undefined) {
    safeUpdates.avatar = safeUpdates.photoURL;
  }

  if (safeUpdates.avatar !== undefined && safeUpdates.photoURL === undefined) {
    safeUpdates.photoURL = safeUpdates.avatar;
  }

  if (safeUpdates.gender !== undefined) {
    const existingGender = existing?.gender;

    if (existingGender && existingGender !== safeUpdates.gender) {
      const lastChangedAt = existing?.genderLastChangedAt
        ? new Date(existing.genderLastChangedAt).getTime()
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

      safeUpdates.genderLastChangedAt = now;
    } else if (!existingGender) {
      safeUpdates.genderLastChangedAt = now;
    }
  }

  const willBeOnboardingComplete =
    safeUpdates.onboardingComplete === true ||
    (existing.onboardingComplete === true && safeUpdates.onboardingComplete !== false);
  if (willBeOnboardingComplete) {
    const merged = { ...existing, ...safeUpdates };
    const phoneVal = merged.phone || merged.phoneNumber;
    const nameVal = merged.displayName;
    const ageVal = merged.age;
    const genderVal = merged.gender;
    const cityVal = merged.city;

    if (
      !phoneVal ||
      String(phoneVal).trim() === '' ||
      !nameVal ||
      String(nameVal).trim() === '' ||
      ageVal === undefined ||
      ageVal === null ||
      !genderVal ||
      String(genderVal).trim() === '' ||
      !cityVal ||
      String(cityVal).trim() === ''
    ) {
      return {
        safeUpdates: {},
        error:
          'Cannot complete onboarding: displayName, age, gender, city, and phone are all required.',
        statusCode: 400,
      };
    }
  }

  if (Object.keys(safeUpdates).length === 0) {
    return { safeUpdates, error: null, statusCode: 200 };
  }

  safeUpdates.updatedAt = now;
  return { safeUpdates, error: null, statusCode: 200 };
}
