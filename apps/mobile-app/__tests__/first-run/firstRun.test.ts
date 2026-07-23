import {
  calculateAge,
  firstRunRoute,
  formatDateOfBirth,
  parseDateOfBirth,
  resolveFirstRunStage,
  resolveMinimumAccountAge,
  unwrapFirstRunSnapshot,
} from '@/lib/firstRun';

function user(overrides: Record<string, unknown> = {}) {
  return {
    uid: 'user-1',
    phoneNumber: '+919999999999',
    email: 'person@example.com',
    providerData: [{ providerId: 'google.com' }, { providerId: 'phone' }],
    ...overrides,
  } as any;
}

describe('first-run stage resolution', () => {
  it('requires a Firebase-linked phone for provider accounts', () => {
    expect(resolveFirstRunStage(user({ phoneNumber: null, providerData: [{ providerId: 'google.com' }] }), {}, null)).toBe('phone_required');
  });

  it('offers optional email once for phone-first accounts', () => {
    expect(resolveFirstRunStage(user({ email: null, providerData: [{ providerId: 'phone' }] }), {}, null)).toBe('email_optional');
  });

  it('moves through identity, city, tastes and intent from canonical fields', () => {
    expect(resolveFirstRunStage(user(), {}, null)).toBe('identity');
    expect(resolveFirstRunStage(user(), { displayName: 'A', dateOfBirth: '2000-01-01' }, null)).toBe('city');
    expect(resolveFirstRunStage(user(), { displayName: 'A', dateOfBirth: '2000-01-01', city: 'Mumbai' }, null)).toBe('tastes');
    expect(resolveFirstRunStage(user(), { displayName: 'A', dateOfBirth: '2000-01-01', city: 'Mumbai', vibeTags: ['clubs', 'lounges', 'live_music'] }, null)).toBe('intent');
  });

  it('preserves completed legacy users during migration', () => {
    expect(resolveFirstRunStage(user(), { onboardingComplete: true, basicSetupComplete: true }, null)).toBe('complete');
  });

  it('treats the authenticated server completion stage as canonical', () => {
    expect(resolveFirstRunStage(user(), {}, { currentStage: 'complete', completed: true })).toBe('complete');
  });

  it('maps complete to Explore and calculates age without birthday drift', () => {
    expect(firstRunRoute('complete')).toBe('/(tabs)/explore');
    expect(calculateAge(new Date('2000-07-12T12:00:00Z'), new Date('2026-07-11T12:00:00Z'))).toBe(25);
  });

  it('carries the server-owned minimum age policy in the canonical snapshot', () => {
    const snapshot = { currentStage: 'identity', minimumAccountAge: 21 } as const;
    expect(resolveMinimumAccountAge(snapshot)).toBe(21);
    expect(resolveMinimumAccountAge(null)).toBe(18);
  });

  it('round-trips date of birth through the date-only gateway contract', () => {
    expect(formatDateOfBirth(new Date(2000, 0, 9))).toBe('2000-01-09');
    expect(formatDateOfBirth(parseDateOfBirth('2000-01-09')!)).toBe('2000-01-09');
    expect(parseDateOfBirth('2000-02-29')).not.toBeNull();
    expect(parseDateOfBirth('2000-02-30')).toBeNull();
    expect(parseDateOfBirth('2000-01-09T00:00:00.000Z')).toBeNull();
  });

  it('unwraps canonical bootstrap values from flat and nested gateway envelopes', () => {
    const canonical = {
      version: 2,
      currentStage: 'complete' as const,
      completed: true,
      displayName: 'Aayush',
      dateOfBirth: '2000-01-01',
      cityId: 'pune',
      cityName: 'Pune',
      vibeTags: ['clubs', 'live_music', 'lounges'] as const,
      intents: ['discover'] as const,
    };

    expect(
      unwrapFirstRunSnapshot({ snapshot: canonical, requirements: { minimumAccountAge: 21 } }),
    ).toMatchObject({ ...canonical, minimumAccountAge: 21 });
    expect(unwrapFirstRunSnapshot({ data: { snapshot: canonical } })).toMatchObject(canonical);
  });

  it('preserves revisit values when a legacy step response omits them', () => {
    const previous = {
      currentStage: 'tastes' as const,
      displayName: 'Aayush',
      dateOfBirth: '2000-01-01',
      cityId: 'pune',
      cityName: 'Pune',
      vibeTags: ['clubs', 'live_music', 'lounges'] as const,
    };

    expect(
      unwrapFirstRunSnapshot(
        { onboarding: { version: 2, currentStage: 'intent' } },
        previous as any,
      ),
    ).toMatchObject({ ...previous, version: 2, currentStage: 'intent' });
  });
});
