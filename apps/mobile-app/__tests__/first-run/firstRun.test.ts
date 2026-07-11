import { calculateAge, firstRunRoute, resolveFirstRunStage } from '@/lib/firstRun';

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
});
