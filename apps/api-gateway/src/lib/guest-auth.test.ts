import { describe, expect, it } from 'vitest';
import {
  buildGuestAuthBootstrap,
  buildGuestProfileCreatePayload,
  buildGuestProfileUpdates,
  getGuestOnboardingState,
  normalizeGuestProfile,
} from './guest-auth';

describe('guest-auth contracts', () => {
  it('normalizes a Firestore user doc into the GP-1 guest profile DTO', () => {
    expect(
      normalizeGuestProfile({
        uid: 'user_1',
        email: 'guest@example.com',
        displayName: 'Guest',
        avatar: 'https://cdn.example/avatar.jpg',
        phoneNumber: '+919999999999',
        city: 'Mumbai',
        age: '24',
        gender: 'woman',
        onboardingComplete: true,
        hostStatus: 'pending',
        attendedEvents: ['event_1'],
      }),
    ).toEqual({
      uid: 'user_1',
      email: 'guest@example.com',
      displayName: 'Guest',
      photoURL: 'https://cdn.example/avatar.jpg',
      avatar: 'https://cdn.example/avatar.jpg',
      phone: '+919999999999',
      city: 'Mumbai',
      instagram: '',
      age: '24',
      gender: 'woman',
      onboardingComplete: true,
      hostStatus: 'pending',
      attendedEvents: ['event_1'],
      createdAt: null,
      updatedAt: null,
      role: null,
      venueId: null,
      partnerId: null,
      onboardingStatus: null,
      isApproved: false,
    });
  });

  it('builds canonical auth bootstrap with shell and route access state', () => {
    const bootstrap = buildGuestAuthBootstrap({
      user: {
        uid: 'user_1',
        email: 'guest@example.com',
        firebase: { sign_in_provider: 'password' },
        email_verified: true,
      },
      rawProfile: {
        uid: 'user_1',
        email: 'guest@example.com',
        displayName: 'Guest',
        onboardingComplete: true,
      },
      unreadNotificationCount: 3,
    });

    expect(bootstrap.identity).toMatchObject({
      uid: 'user_1',
      email: 'guest@example.com',
      providerId: 'password',
      emailVerified: true,
    });
    expect(bootstrap.shell).toEqual({
      unreadNotificationCount: 3,
      hasUnreadNotifications: true,
    });
    expect(bootstrap.routeAccess).toMatchObject({
      canAccessProfile: true,
      shouldRedirectFromAuthPages: true,
      requiresOnboarding: false,
      profilePath: '/profile/user_1',
    });
    expect(bootstrap.onboarding).toMatchObject({
      onboardingComplete: true,
      state: 'complete',
    });
  });

  it('uses a single canonical onboarding rule derived from onboardingComplete', () => {
    expect(
      getGuestOnboardingState({
        onboardingComplete: true,
        phone: null,
        gender: null,
      }),
    ).toEqual({
      onboardingComplete: true,
      state: 'complete',
    });

    expect(
      getGuestOnboardingState({
        onboardingComplete: false,
        phone: '+15555550123',
        gender: 'woman',
      }),
    ).toEqual({
      onboardingComplete: false,
      state: 'needs_onboarding',
    });
  });

  it('creates profile payloads from authenticated identity and browser-provided ritual data', () => {
    expect(
      buildGuestProfileCreatePayload(
        {
          uid: 'spoofed',
          email: 'guest@example.com',
          displayName: 'Guest',
          gender: 'man',
          age: 25,
          phone: '+919999999999',
          city: 'Goa',
          onboardingComplete: true,
        },
        {
          uid: 'user_1',
          email: 'guest@example.com',
        },
        '2026-04-20T00:00:00.000Z',
      ),
    ).toMatchObject({
      uid: 'user_1',
      email: 'guest@example.com',
      displayName: 'Guest',
      gender: 'man',
      age: 25,
      phone: '+919999999999',
      city: 'Goa',
      onboardingComplete: true,
      createdAt: '2026-04-20T00:00:00.000Z',
      updatedAt: '2026-04-20T00:00:00.000Z',
    });
  });

  it('preserves the 30-day gender change cooldown', () => {
    const result = buildGuestProfileUpdates(
      { gender: 'woman' },
      { gender: 'man', genderLastChangedAt: '2026-04-01T00:00:00.000Z' },
      '2026-04-20T00:00:00.000Z',
    );

    expect(result.statusCode).toBe(429);
    expect(result.error).toMatch(/Gender can only be changed once every 30 days/);
  });

  it('normalizes avatar and phone fields during safe guest profile updates', () => {
    const result = buildGuestProfileUpdates(
      {
        photoURL: 'https://cdn.example/new.jpg',
        phoneNumber: '+919999999999',
        ignoredAdminField: true,
      },
      {},
      '2026-04-20T00:00:00.000Z',
    );

    expect(result.error).toBeNull();
    expect(result.safeUpdates).toEqual({
      photoURL: 'https://cdn.example/new.jpg',
      phoneNumber: '+919999999999',
      phone: '+919999999999',
      avatar: 'https://cdn.example/new.jpg',
      updatedAt: '2026-04-20T00:00:00.000Z',
    });
  });
});
