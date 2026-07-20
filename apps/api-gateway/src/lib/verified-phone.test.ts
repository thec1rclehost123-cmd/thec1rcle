import { describe, expect, it } from 'vitest';
import { hasVerifiedFirebasePhone } from './verified-phone';

describe('verified Firebase phone claims', () => {
  it('accepts only a Firebase-signed E.164 phone_number claim', () => {
    expect(hasVerifiedFirebasePhone({ phone_number: '+919999999999' })).toBe(true);
    expect(hasVerifiedFirebasePhone({ phoneNumber: '+919999999999' })).toBe(false);
    expect(hasVerifiedFirebasePhone({ phone: '+919999999999' })).toBe(false);
    expect(hasVerifiedFirebasePhone({ phone_number: '9999999999' })).toBe(false);
    expect(hasVerifiedFirebasePhone(null)).toBe(false);
  });
});
