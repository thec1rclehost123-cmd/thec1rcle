import { sanitizeFirstRunProperties } from '@/lib/firstRunAnalytics';

describe('first-run analytics privacy', () => {
  it('keeps approved diagnostic dimensions', () => {
    expect(
      sanitizeFirstRunProperties({
        stage: 'city',
        provider: 'google',
        cityId: 'pune',
        tasteCount: 3,
        requestId: 'request_1',
        errorCode: 'network_error',
        countryCode: '+91',
      }),
    ).toEqual({
      stage: 'city',
      provider: 'google',
      cityId: 'pune',
      tasteCount: 3,
      requestId: 'request_1',
      errorCode: 'network_error',
      countryCode: '+91',
    });
  });

  it('drops raw contact, identity and location payloads', () => {
    expect(
      sanitizeFirstRunProperties({
        phoneNumber: '+919999999999',
        email: 'member@example.com',
        otp: '123456',
        dateOfBirth: '1995-01-01',
        latitude: 18.5204,
        longitude: 73.8567,
        firebaseToken: 'secret',
        errorPayload: { message: 'raw provider response' },
        stage: 'otp',
      }),
    ).toEqual({ stage: 'otp' });
  });
});
