export type OnboardingStage =
  | 'phone_required'
  | 'email_optional'
  | 'identity'
  | 'city'
  | 'tastes'
  | 'intent'
  | 'complete';

export type NightlifeTaste =
  | 'clubs'
  | 'live_music'
  | 'lounges'
  | 'festivals'
  | 'college_nights'
  | 'underground'
  | 'food_culture'
  | 'premium';

export type UserIntent = 'discover' | 'friends' | 'meet_people' | 'host_promote';

export type OnboardingSnapshot = {
  version: 2;
  currentStage: OnboardingStage;
  completed: boolean;
  emailPromptStatus:
    | 'not_shown'
    | 'shown'
    | 'skipped'
    | 'pending_verification'
    | 'verified';
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string | null;
  displayName: string | null;
  dateOfBirth: string | null;
  cityId: string | null;
  cityName: string | null;
  vibeTags: NightlifeTaste[];
  intents: UserIntent[];
};

export type OnboardingBootstrap = {
  identity: Record<string, unknown>;
  onboarding: { version: 2; currentStage: OnboardingStage; completed: boolean } & Record<string, unknown>;
  snapshot: OnboardingSnapshot;
  requirements: { minimumAccountAge: number; minimumTastes: number };
  routeAccess: {
    canBrowsePublicExplore: boolean;
    canAccessSignedInExplore: boolean;
    canCheckout: boolean;
    canUseChat: boolean;
  };
};

export function normalizeAuthIdentity(userId: string, authRecord?: any, existingData?: any): any;
export function computeOnboardingStage(data?: any, authIdentity?: any): OnboardingStage;
export function buildOnboardingBootstrap(userId: string, data?: any, authRecord?: any): OnboardingBootstrap;
export function getOnboardingBootstrap(db: any, userId: string, authRecord?: any): Promise<OnboardingBootstrap>;
export function syncOnboardingAuthState(db: any, userId: string, authRecord?: any): Promise<OnboardingBootstrap>;
export function updateOnboardingIdentity(db: any, userId: string, payload: any): Promise<any>;
export function updateOnboardingCity(db: any, userId: string, payload: any): Promise<any>;
export function updateOnboardingPreferences(db: any, userId: string, payload: any): Promise<any>;
export function recordEmailPrompt(
  db: any,
  userId: string,
  status: 'shown' | 'skipped',
): Promise<any>;
export function completeOnboarding(
  db: any,
  userId: string,
  authRecord?: any,
): Promise<OnboardingBootstrap & {
  destination: '/(tabs)/explore';
  personalizationSummary: Record<string, unknown>;
}>;
export const onboardingConstants: {
  version: 2;
  minimumAccountAge: number;
  minimumTastes: number;
  validTastes: string[];
  validIntents: string[];
};
