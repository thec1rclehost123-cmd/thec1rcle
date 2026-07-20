/* global jest, describe, beforeEach, it, expect */

const mockNativeAuthInstance = {
  currentUser: null as any,
};

jest.mock('react-native', () => ({ NativeModules: {} }));

jest.mock('../../lib/firebase/config', () => ({
  firebaseConfig: {
    apiKey: 'test-key',
    appId: 'test-app',
    authDomain: 'test.firebaseapp.com',
    projectId: 'test-project',
  },
}));

jest.mock('@react-native-firebase/auth', () => {
  const auth = jest.fn(() => mockNativeAuthInstance) as any;
  auth.GoogleAuthProvider = { credential: jest.fn() };
  auth.AppleAuthProvider = { credential: jest.fn() };
  auth.PhoneAuthProvider = { credential: jest.fn() };
  return { __esModule: true, default: auth };
});

import { linkEmailToUser, sendVerificationLinkToCurrentUser } from '../../lib/firebase/client';

describe('phone-first recovery email linking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNativeAuthInstance.currentUser = {
      uid: 'phone-user-1',
      updateEmail: jest.fn().mockResolvedValue(undefined),
      sendEmailVerification: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('updates the email without changing the signed-in Firebase user', async () => {
    const originalUser = mockNativeAuthInstance.currentUser;

    const result = await linkEmailToUser('member@example.com');

    expect(originalUser.updateEmail).toHaveBeenCalledWith('member@example.com');
    expect(result).toBe(originalUser);
    expect(result.uid).toBe('phone-user-1');
  });

  it('sends verification with the configured in-app return URL', async () => {
    await sendVerificationLinkToCurrentUser('https://c1rcle-staging.firebaseapp.com/verify');

    expect(mockNativeAuthInstance.currentUser.sendEmailVerification).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://c1rcle-staging.firebaseapp.com/verify',
        handleCodeInApp: true,
        iOS: { bundleId: 'com.c1rcle.app' },
        android: expect.objectContaining({ packageName: 'com.c1rcle.app' }),
      }),
    );
  });
});
