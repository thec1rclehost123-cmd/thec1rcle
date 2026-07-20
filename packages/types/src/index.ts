export interface Address {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  lat?: number;
  lng?: number;
}

export interface StandardErrorDetail {
  path: string;
  message: string;
}

export interface StandardErrorPayload {
  code: string;
  message: string;
  details?: StandardErrorDetail[] | Record<string, unknown> | null;
  requestId?: string;
}

export interface StandardErrorResponse {
  error: StandardErrorPayload;
}

export type ApiErrorPayload = StandardErrorPayload;

export interface Venue {
  id: string;
  name: string;
  slug: string;
  description?: string;
  address?: Address;
  city?: string;
  cityKey?: string;
  photoURL?: string;
  image?: string;
  facilities?: string[];
  capacity?: number;
  contactEmail?: string;
  contactPhone?: string;
  socials?: {
    instagram?: string;
    website?: string;
    facebook?: string;
  };
}

export interface Event {
  id: string;
  title: string;
  summary?: string;
  description?: string;
  image?: string;
  startDate: string;
  endDate?: string;
  venueId?: string;
  venue?: string; // Venue name or slug
  host?: string; // Host handle
  hostId?: string;
  lifecycle: 'draft' | 'published' | 'cancelled' | 'past';
  status: 'upcoming' | 'live' | 'past';
  tags?: string[];
  category?: string;
  eventType?: string;
  heatScore?: number;
  isFree?: boolean;
  startingPrice?: number;
  priceRange?: {
    min: number;
    max: number;
  };
  settings?: {
    showGuestlist?: boolean;
    activity?: boolean;
    surgeProtection?: boolean;
  };
  cancellationReason?: string;
  refundPolicy?: 'full' | 'partial' | 'none';
  partialRefundPercent?: number;
  refundStatus?: 'pending' | 'completed' | 'failed';
}

export interface Profile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phoneNumber?: string;
  bio?: string;
  city?: string;
  instagram?: string;
  attendedEvents?: string[];
  likedEvents?: string[];
  createdAt: string;
  updatedAt: string;
}

export const ONBOARDING_V2_VERSION = 2 as const;

export const AUTH_PROVIDERS = ['apple', 'google', 'phone'] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export const ONBOARDING_STAGES = [
  'phone_required',
  'email_optional',
  'identity',
  'city',
  'tastes',
  'intent',
  'complete',
] as const;
export type OnboardingStage = (typeof ONBOARDING_STAGES)[number];

export const NIGHTLIFE_TASTES = [
  'clubs',
  'live_music',
  'lounges',
  'festivals',
  'college_nights',
  'underground',
  'food_culture',
  'premium',
] as const;
export type NightlifeTaste = (typeof NIGHTLIFE_TASTES)[number];

export const USER_INTENTS = ['discover', 'friends', 'meet_people', 'host_promote'] as const;
export type UserIntent = (typeof USER_INTENTS)[number];

export type EmailPromptStatus =
  | 'not_shown'
  | 'shown'
  | 'skipped'
  | 'pending_verification'
  | 'verified';

export interface FirstRunIdentity {
  uid: string;
  providers: AuthProvider[];
  primaryProvider: AuthProvider | null;
  email: string | null;
  emailVerified: boolean;
  emailSource: AuthProvider | 'manual' | null;
  phoneNumberE164: string | null;
  phoneVerified: boolean;
  phoneVerifiedAt: string | null;
}

export interface FirstRunOnboardingState {
  version: typeof ONBOARDING_V2_VERSION;
  currentStage: OnboardingStage;
  completed: boolean;
  emailPromptStatus: EmailPromptStatus;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string | null;
}

export interface FirstRunRouteAccess {
  canBrowsePublicExplore: boolean;
  canAccessSignedInExplore: boolean;
  canCheckout: boolean;
  canUseChat: boolean;
}

export interface FirstRunRequirements {
  minimumAccountAge: number;
  minimumTastes: number;
}

export interface FirstRunBootstrap {
  identity: FirstRunIdentity;
  onboarding: FirstRunOnboardingState;
  requirements: FirstRunRequirements;
  routeAccess: FirstRunRouteAccess;
}

export interface OnboardingIdentityUpdate {
  displayName: string;
  dateOfBirth: string;
}

export interface OnboardingCityUpdate {
  cityId: string;
  cityName: string;
  source: 'manual' | 'location';
}

export interface OnboardingPreferencesUpdate {
  vibeTags?: NightlifeTaste[];
  intents?: UserIntent[];
}

export type RecommendationReasonCode =
  | 'VIBE_AND_CITY_MATCH'
  | 'VIBE_MATCH'
  | 'CITY_MATCH'
  | 'INTENT_MATCH'
  | 'HISTORY_MATCH'
  | 'VENUE_MATCH'
  | 'POPULAR_NEARBY'
  | 'TRENDING';

export interface RecommendationItem<TEvent = Event & Record<string, unknown>> {
  event: TEvent;
  score: number;
  reasonCode: RecommendationReasonCode;
  reasonLabel: string;
}

export interface RecommendationV2Response<TEvent = Event & Record<string, unknown>> {
  modelVersion: 'explore-v2';
  profileVersion: number;
  items: RecommendationItem<TEvent>[];
  fallbackUsed: boolean;
}

export type RecommendationSignalType =
  | 'event_view'
  | 'event_save'
  | 'venue_follow'
  | 'category_browse';

export interface RecommendationSignal {
  type: RecommendationSignalType;
  category?: string;
  eventId?: string;
  venueId?: string;
}

export interface GuestProfileDto {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  avatar: string | null;
  phone: string | null;
  city: string;
  instagram: string;
  age: number | string | null;
  gender: string | null;
  onboardingComplete: boolean;
  hostStatus: string | null;
  attendedEvents: string[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface GuestAuthIdentityDto {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  phoneNumber: string | null;
  providerId: string | null;
  emailVerified: boolean;
}

export interface GuestAuthBootstrapDto {
  identity: GuestAuthIdentityDto;
  profile: GuestProfileDto | null;
  onboarding: {
    onboardingComplete: boolean;
    state: 'complete' | 'needs_onboarding';
    hostStatus: string | null;
    onboardingRequest?: Record<string, unknown> | null;
  };
  shell: {
    unreadNotificationCount: number;
    hasUnreadNotifications: boolean;
  };
  routeAccess: {
    isAuthenticated: boolean;
    canAccessProfile: boolean;
    shouldRedirectFromAuthPages: boolean;
    requiresOnboarding: boolean;
    profilePath: string | null;
  };
}

export interface GuestAuthCheckRequest {
  email: string;
}

export interface GuestAuthCheckResponse {
  exists: boolean;
}

export interface GuestOtpSendRequest {
  type: 'email' | 'phone';
  recipient: string;
}

export interface GuestOtpSendResponse {
  message: string;
}

export interface GuestOtpVerifyRequest {
  type: 'email' | 'phone';
  recipient: string;
  code: string;
}

export interface GuestOtpVerifyResponse {
  success: boolean;
}

export interface GuestEventInterestedUser {
  id: string;
  name: string;
  handle?: string;
  photoURL?: string | null;
  initials?: string;
  gender?: string;
}

export interface GuestEventInterested {
  count: number;
  users: GuestEventInterestedUser[];
}

export interface GuestEventDetailResponse {
  event: Event & Record<string, unknown>;
  interestedData: GuestEventInterested;
}

export interface GuestEventRsvpRequest {
  shouldInclude: boolean;
}

export interface GuestEventRsvpResponse {
  success: boolean;
}

export interface GuestEventTrackRequest {
  type?: string;
  ref?: string;
}

export interface GuestEventTrackResponse {
  ok: boolean;
}

export interface GuestEventQueueJoinRequest {
  userId?: string;
}

export interface GuestEventQueueJoinResponse {
  id: string;
  eventId: string;
  userId: string;
  deviceId?: string;
  status: string;
  tier?: string;
  score?: number;
  token?: string;
  lanePosition?: number;
  position?: number;
  expiresAt?: string;
}

export interface GuestEventWaitlistJoinRequest {
  eventId: string;
  ticketId?: string;
  tierId?: string;
  email?: string;
  phone?: string;
}

export interface GuestEventWaitlistEntry {
  id: string;
  eventId: string;
  ticketId?: string;
  tierId?: string;
  userId?: string | null;
  email: string;
  phone?: string | null;
  status: string;
  createdAt: string;
  notifiedAt?: string | null;
  expiresAt?: string;
}

export interface GuestEventWaitlistJoinResponse {
  success: boolean;
  message: string;
  entry: GuestEventWaitlistEntry;
}
