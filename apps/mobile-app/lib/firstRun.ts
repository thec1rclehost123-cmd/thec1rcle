import type { FirebaseAuthTypes } from '@react-native-firebase/auth';

export const FIRST_RUN_VERSION = 2;
export const MIN_NIGHTLIFE_TASTES = 3;

export const NIGHTLIFE_TASTES = [
  { id: 'clubs', label: 'Clubs', description: 'Big rooms and late nights' },
  { id: 'live_music', label: 'Live music', description: 'Gigs, bands and concerts' },
  { id: 'lounges', label: 'Lounges', description: 'Cocktails and conversation' },
  { id: 'festivals', label: 'Festivals', description: 'All-day, all-in experiences' },
  { id: 'college_nights', label: 'College nights', description: 'High-energy campus scenes' },
  { id: 'underground', label: 'Underground', description: 'Hidden rooms and new sounds' },
  { id: 'food_culture', label: 'Food & culture', description: 'Supper clubs and city culture' },
  { id: 'premium', label: 'Premium', description: 'Elevated tables and experiences' },
] as const;

export const USER_INTENTS = [
  { id: 'discover', label: 'Discover events', description: 'Find the best plans around you' },
  { id: 'friends', label: 'Go out with friends', description: 'Make plans with your crew' },
  { id: 'meet_people', label: 'Meet people', description: 'Find social nights and new circles' },
  { id: 'host_promote', label: 'Host or promote', description: 'Build an audience for your events' },
] as const;

export type NightlifeTaste = (typeof NIGHTLIFE_TASTES)[number]['id'];
export type UserIntent = (typeof USER_INTENTS)[number]['id'];
export type FirstRunStage =
  | 'phone_required'
  | 'email_optional'
  | 'identity'
  | 'city'
  | 'tastes'
  | 'intent'
  | 'complete';

export type FirstRunSnapshot = {
  version?: number;
  currentStage?: FirstRunStage;
  completed?: boolean;
  emailPromptStatus?: 'not_shown' | 'shown' | 'skipped' | 'pending_verification' | 'verified';
  displayName?: string;
  dateOfBirth?: string;
  cityId?: string;
  cityName?: string;
  vibeTags?: NightlifeTaste[];
  intents?: UserIntent[];
};

type ProfileLike = Record<string, any> | null | undefined;

export function isPhoneFirstUser(user: FirebaseAuthTypes.User): boolean {
  const providerIds = user.providerData.map((provider) => provider.providerId);
  return providerIds.includes('phone') &&
    !providerIds.includes('google.com') &&
    !providerIds.includes('apple.com');
}

export function resolveFirstRunStage(
  user: FirebaseAuthTypes.User,
  profile: ProfileLike,
  server?: FirstRunSnapshot | null,
): FirstRunStage {
  if (!user.phoneNumber || !user.providerData.some((provider) => provider.providerId === 'phone')) {
    return 'phone_required';
  }

  // The authenticated backend snapshot is canonical, including completion.
  // Reconstructing a completed stage from a partially cached profile can send
  // returning users back into onboarding.
  if (server?.currentStage) return server.currentStage;

  const onboarding = profile?.onboarding ?? {};
  const discovery = profile?.discoveryProfile ?? {};
  const identity = profile?.identity ?? {};
  const emailPromptStatus = server?.emailPromptStatus ?? onboarding.emailPromptStatus;

  // Compatibility window for already-completed v1 accounts. The backend migration
  // will make this unnecessary once all profiles carry onboarding.version >= 2.
  if (profile?.onboardingComplete === true &&
    (profile?.basicSetupComplete === true || profile?.profileSetupComplete === true)) {
    return 'complete';
  }

  if (isPhoneFirstUser(user) && !user.email && !['skipped', 'pending_verification', 'verified'].includes(emailPromptStatus)) {
    return 'email_optional';
  }

  const displayName = server?.displayName ?? identity.displayName ?? profile?.displayName;
  const dateOfBirth = server?.dateOfBirth ?? identity.dateOfBirth ?? profile?.dateOfBirth;
  if (!displayName || !dateOfBirth) return 'identity';

  const city = server?.cityId ?? server?.cityName ?? discovery.cityId ?? discovery.cityName ?? profile?.city;
  if (!city) return 'city';

  const tastes = server?.vibeTags ?? discovery.vibeTags ?? profile?.vibeTags ?? [];
  if (!Array.isArray(tastes) || tastes.length < MIN_NIGHTLIFE_TASTES) return 'tastes';

  const intents = server?.intents ?? discovery.intents ?? profile?.intents ?? [];
  if (!Array.isArray(intents) || intents.length === 0) return 'intent';

  return 'complete';
}

export function firstRunRoute(stage: FirstRunStage): string {
  const routes: Record<FirstRunStage, string> = {
    phone_required: '/phone-required',
    email_optional: '/email-optional',
    identity: '/identity',
    city: '/city',
    tastes: '/tastes',
    intent: '/intent',
    complete: '/(tabs)/explore',
  };
  return routes[stage];
}

export function calculateAge(date: Date, now = new Date()): number {
  let age = now.getFullYear() - date.getFullYear();
  const beforeBirthday = now.getMonth() < date.getMonth() ||
    (now.getMonth() === date.getMonth() && now.getDate() < date.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}
