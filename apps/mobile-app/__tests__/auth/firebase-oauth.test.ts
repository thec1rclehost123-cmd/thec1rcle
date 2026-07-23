/* global jest, describe, beforeEach, it, expect */

const mockGoogleCredential = { providerId: 'google.com' };
const mockNativeAuthInstance = {
  currentUser: null,
  signInWithCredential: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  fetchSignInMethodsForEmail: jest.fn(),
};
const mockGoogleSignin = {
  configure: jest.fn(),
  hasPlayServices: jest.fn(async () => true),
  signIn: jest.fn(),
  getTokens: jest.fn(async () => ({
    idToken: 'google-id-token',
    accessToken: 'google-access-token',
  })),
};

jest.mock('react-native', () => ({
  NativeModules: { RNGoogleSignin: {} },
}));

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
  auth.GoogleAuthProvider = {
    credential: jest.fn(() => mockGoogleCredential),
  };
  auth.AppleAuthProvider = { credential: jest.fn() };
  auth.PhoneAuthProvider = { credential: jest.fn() };
  return { __esModule: true, default: auth };
});

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: mockGoogleSignin,
}));

import {
  clearPendingProviderLink,
  getPendingProviderLink,
  loginWithEmail,
  loginWithGoogle,
} from '../../lib/firebase/client';
describe('Firebase OAuth helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearPendingProviderLink();
    mockGoogleSignin.signIn.mockResolvedValue({
      data: {
        idToken: 'google-id-token',
        user: { email: 'person@example.com' },
      },
    });
  });

  it('stores and links a Google credential when the email already has a password account', async () => {
    mockNativeAuthInstance.signInWithCredential.mockRejectedValueOnce({
      code: 'auth/account-exists-with-different-credential',
      customData: { email: 'person@example.com' },
    });
    mockNativeAuthInstance.fetchSignInMethodsForEmail.mockResolvedValueOnce(['password']);

    await expect(loginWithGoogle()).rejects.toMatchObject({
      code: 'auth/link-with-password-required',
      email: 'person@example.com',
      providerName: 'Google',
    });

    expect(getPendingProviderLink()).toEqual({
      email: 'person@example.com',
      providerId: 'google.com',
      providerName: 'Google',
    });

    const passwordUser = {
      email: 'person@example.com',
      linkWithCredential: jest.fn().mockResolvedValueOnce({}),
    };
    mockNativeAuthInstance.signInWithEmailAndPassword.mockResolvedValueOnce({ user: passwordUser });

    await loginWithEmail('person@example.com', 'correct-password');

    expect(passwordUser.linkWithCredential).toHaveBeenCalledWith(mockGoogleCredential);
    expect(getPendingProviderLink()).toBeNull();
  });
});
