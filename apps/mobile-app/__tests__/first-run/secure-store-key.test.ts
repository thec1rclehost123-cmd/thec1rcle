import { secureStoreKey } from '../../lib/secureStoreKey';

describe('SecureStore key compatibility', () => {
  it('normalizes Firebase and app keys to the Android-safe character set', () => {
    expect(secureStoreKey('firebase:authUser:api/key@app')).toBe(
      'firebase_authUser_api_key_app',
    );
    expect(secureStoreKey('c1rcle.valid-key_1')).toBe('c1rcle.valid-key_1');
  });

  it('rejects an empty key', () => {
    expect(() => secureStoreKey('')).toThrow('SecureStore key cannot be empty.');
  });
});
