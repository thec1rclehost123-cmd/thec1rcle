import { describe, expect, it } from 'vitest';
import { getVerifiedFirebasePhone, hasVerifiedFirebasePhone } from './verified-phone.js';

describe('verified Firebase phone identity', () => {
  it('accepts the canonical decoded Firebase phone_number claim', () => {
    expect(getVerifiedFirebasePhone({ uid: 'u1', phone_number: '+919999999999' })).toBe(
      '+919999999999',
    );
  });

  it('accepts a Firebase Admin user record when a refreshed claim is not present yet', () => {
    expect(getVerifiedFirebasePhone({ uid: 'u1' }, { phoneNumber: '+14155552671' })).toBe(
      '+14155552671',
    );
  });

  it('rejects absent, malformed, and client-profile-only phone values', () => {
    expect(hasVerifiedFirebasePhone({ uid: 'u1' })).toBe(false);
    expect(hasVerifiedFirebasePhone({ uid: 'u1', phone_number: '9999999999' })).toBe(false);
    expect(hasVerifiedFirebasePhone({ uid: 'u1', profile: { phoneNumber: '+919999999999' } })).toBe(
      false,
    );
  });
});
