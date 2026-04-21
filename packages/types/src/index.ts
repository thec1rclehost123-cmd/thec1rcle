export interface Address {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  lat?: number;
  lng?: number;
}

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
