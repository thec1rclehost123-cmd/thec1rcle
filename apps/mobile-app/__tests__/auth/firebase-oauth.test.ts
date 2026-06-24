/* global jest, describe, beforeEach, it, expect */

const mockAuth = { currentUser: null };
const mockGoogleCredential = { providerId: 'google.com' };
const mockGoogleSignin = {
  configure: jest.fn(),
  hasPlayServices: jest.fn(async () => true),
  signIn: jest.fn(),
};

jest.mock('react-native', () => ({
  NativeModules: { RNGoogleSignin: {} },
}));

jest.mock('firebase/app', () => ({
  getApp: jest.fn(() => ({})),
  getApps: jest.fn(() => [{}]),
  initializeApp: jest.fn(() => ({})),
}));

jest.mock('../../lib/firebase/config', () => ({
  firebaseConfig: {
    apiKey: 'test-key',
    appId: 'test-app',
    authDomain: 'test.firebaseapp.com',
    projectId: 'test-project',
  },
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => mockAuth),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  onAuthStateChanged: jest.fn(),
  signInWithCredential: jest.fn(),
  linkWithCredential: jest.fn(),
  fetchSignInMethodsForEmail: jest.fn(),
  GoogleAuthProvider: {
    credential: jest.fn(() => mockGoogleCredential),
  },
  PhoneAuthProvider: {
    credential: jest.fn(),
  },
  OAuthProvider: jest.fn().mockImplementation((providerId) => ({
    credential: jest.fn(({ idToken }) => ({ providerId, idToken })),
  })),
  EmailAuthProvider: {
    EMAIL_PASSWORD_SIGN_IN_METHOD: 'password',
  },
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: mockGoogleSignin,
}));

import {
  clearPendingProviderLink,
  getPendingProviderLink,
  loginWithEmail,
  loginWithGoogle,
} from '../../lib/firebase/client';
import {
  fetchSignInMethodsForEmail,
  linkWithCredential,
  signInWithCredential,
  signInWithEmailAndPassword,
} from 'firebase/auth';

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
    (signInWithCredential as jest.Mock).mockRejectedValueOnce({
      code: 'auth/account-exists-with-different-credential',
      customData: { email: 'person@example.com' },
    });
    (fetchSignInMethodsForEmail as jest.Mock).mockResolvedValueOnce(['password']);

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

    const passwordUser = { email: 'person@example.com' };
    (signInWithEmailAndPassword as jest.Mock).mockResolvedValueOnce({ user: passwordUser });
    (linkWithCredential as jest.Mock).mockResolvedValueOnce({});

    await loginWithEmail('person@example.com', 'correct-password');

    expect(linkWithCredential).toHaveBeenCalledWith(passwordUser, mockGoogleCredential);
    expect(getPendingProviderLink()).toBeNull();
  });
});
