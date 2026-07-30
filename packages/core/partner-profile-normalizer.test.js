import { describe, expect, it } from 'vitest';
import { normalizePartnerProfileFields } from './partner-profile-normalizer.js';

describe('normalizePartnerProfileFields', () => {
  it('maps onboarding aliases into the canonical private-contact and public-profile fields', () => {
    expect(
      normalizePartnerProfileFields('promoter', {
        name: 'Night Shift',
        email: 'TEAM@EXAMPLE.COM',
        phoneNumber: '+919876543210',
        description: 'Independent promoter',
        username: '@Night_Shift',
        instagram: '@nightshift',
        websiteUrl: 'https://nightshift.example',
      }),
    ).toMatchObject({
      name: 'Night Shift',
      displayName: 'Night Shift',
      brandName: 'Night Shift',
      contactEmail: 'team@example.com',
      contactPhone: '+919876543210',
      bio: 'Independent promoter',
      handle: 'night_shift',
      username: 'night_shift',
      instagramHandle: '@nightshift',
      website: 'https://nightshift.example',
      contactVisibility: {
        email: 'connected',
        phone: 'connected',
        website: 'public',
      },
    });
  });

  it('does not persist blank alias fields that would overwrite existing profile data', () => {
    const result = normalizePartnerProfileFields('venue', {
      name: 'The Room',
      phone: '   ',
      website: '',
    });

    expect(result).toMatchObject({
      name: 'The Room',
      displayName: 'The Room',
      venueName: 'The Room',
    });
    expect(result).not.toHaveProperty('contactPhone');
    expect(result).not.toHaveProperty('website');
  });
});
