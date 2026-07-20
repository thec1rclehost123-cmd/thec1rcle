import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import {
  DEFAULT_MIN_ACCOUNT_AGE,
  MIN_NIGHTLIFE_TASTES,
  NIGHTLIFE_TASTE_OPTIONS,
  ONBOARDING_V2_VERSION,
  USER_INTENT_OPTIONS,
  type EmailPromptStatus,
  type NightlifeTaste,
  type OnboardingStage,
  type UserIntent,
} from '@c1rcle/types';

export const FIRST_RUN_VERSION = ONBOARDING_V2_VERSION;
export { DEFAULT_MIN_ACCOUNT_AGE, MIN_NIGHTLIFE_TASTES };
export const NIGHTLIFE_TASTES = NIGHTLIFE_TASTE_OPTIONS;
export const USER_INTENTS = USER_INTENT_OPTIONS;
export const DISCOVERY_CITIES = [
  { id: 'pune', name: 'Pune' },
  { id: 'mumbai', name: 'Mumbai' },
  { id: 'delhi', name: 'Delhi' },
  { id: 'bengaluru', name: 'Bengaluru' },
  { id: 'goa', name: 'Goa' },
  { id: 'hyderabad', name: 'Hyderabad' },
  { id: 'chennai', name: 'Chennai' },
  { id: 'kolkata', name: 'Kolkata' },
] as const;
export type { NightlifeTaste, UserIntent };
export type FirstRunStage = OnboardingStage;

export type FirstRunSnapshot = {
  version?: number;
  currentStage?: FirstRunStage;
  completed?: boolean;
  minimumAccountAge?: number;
  emailPromptStatus?: EmailPromptStatus;
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
  return (
    providerIds.includes('phone') &&
    !providerIds.includes('google.com') &&
    !providerIds.includes('apple.com')
  );
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
  if (
    profile?.onboardingComplete === true &&
    (profile?.basicSetupComplete === true || profile?.profileSetupComplete === true)
  ) {
    return 'complete';
  }

  if (
    isPhoneFirstUser(user) &&
    !user.email &&
    !['skipped', 'pending_verification', 'verified'].includes(emailPromptStatus)
  ) {
    return 'email_optional';
  }

  const displayName = server?.displayName ?? identity.displayName ?? profile?.displayName;
  const dateOfBirth = server?.dateOfBirth ?? identity.dateOfBirth ?? profile?.dateOfBirth;
  if (!displayName || !dateOfBirth) return 'identity';

  const city =
    server?.cityId ?? server?.cityName ?? discovery.cityId ?? discovery.cityName ?? profile?.city;
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

export function cityIdFromName(cityName: string): string {
  return cityName.trim().toLowerCase().replace(/\s+/g, '-');
}

export function calculateAge(date: Date, now = new Date()): number {
  let age = now.getFullYear() - date.getFullYear();
  const beforeBirthday =
    now.getMonth() < date.getMonth() ||
    (now.getMonth() === date.getMonth() && now.getDate() < date.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function formatDateOfBirth(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateOfBirth(value?: string | null): Date | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return formatDateOfBirth(date) === value ? date : null;
}
