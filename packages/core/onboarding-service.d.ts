export type OnboardingStage =
  | 'phone_required'
  | 'email_optional'
  | 'identity'
  | 'city'
  | 'tastes'
  | 'intent'
  | 'complete';

export function normalizeAuthIdentity(userId: string, authRecord?: any, existingData?: any): any;
export function computeOnboardingStage(data?: any, authIdentity?: any): OnboardingStage;
export function buildOnboardingBootstrap(userId: string, data?: any, authRecord?: any): any;
export function getOnboardingBootstrap(db: any, userId: string, authRecord?: any): Promise<any>;
export function syncOnboardingAuthState(db: any, userId: string, authRecord?: any): Promise<any>;
export function updateOnboardingIdentity(db: any, userId: string, payload: any): Promise<any>;
export function updateOnboardingCity(db: any, userId: string, payload: any): Promise<any>;
export function updateOnboardingPreferences(db: any, userId: string, payload: any): Promise<any>;
export function recordEmailPrompt(
  db: any,
  userId: string,
  status: 'shown' | 'skipped',
): Promise<any>;
export function completeOnboarding(db: any, userId: string, authRecord?: any): Promise<any>;
export const onboardingConstants: {
  version: 2;
  minimumTastes: number;
  validTastes: string[];
  validIntents: string[];
};
