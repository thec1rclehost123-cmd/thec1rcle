/* global jest, describe, beforeEach, it, expect */

const mockPhoneCredential = { providerId: 'phone' };
const mockNativeAuthInstance = {
  currentUser: null as any,
  verifyPhoneNumber: jest.fn(),
  signInWithCredential: jest.fn(),
};
const mockPhoneCredentialFactory = jest.fn(
  (_verificationId?: string, _verificationCode?: string) => mockPhoneCredential,
);

jest.mock('react-native', () => ({
  NativeModules: {},
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
  const phoneProvider = {
    credential: (...args: [string, string]) => mockPhoneCredentialFactory(...args),
  };
  auth.GoogleAuthProvider = { credential: jest.fn() };
  auth.AppleAuthProvider = { credential: jest.fn() };
  auth.PhoneAuthProvider = phoneProvider;
  return { __esModule: true, default: auth };
});

import {
  linkWithPhoneVerificationCode,
  sendPhoneLinkVerificationCode,
} from '../../lib/firebase/client';

function providerUser(providerId: 'apple.com' | 'google.com') {
  const user: any = {
    uid: `uid-${providerId}`,
    providerData: [{ providerId }],
    linkWithCredential: jest.fn(),
    getIdTokenResult: jest.fn(),
  };
  user.linkWithCredential.mockImplementation(async () => {
    user.providerData = [{ providerId }, { providerId: 'phone' }];
    return { user };
  });
  user.getIdTokenResult.mockResolvedValue({ claims: { sub: user.uid } });
  return user;
}

describe.each([
  ['Apple', 'apple.com'],
  ['Google', 'google.com'],
] as const)('%s account phone linking', (_providerName, providerId) => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNativeAuthInstance.currentUser = null;
    mockNativeAuthInstance.verifyPhoneNumber.mockResolvedValue({
      verificationId: 'verification-id',
    });
  });

  it('keeps one UID through OTP send, credential link and token refresh', async () => {
    const user = providerUser(providerId);
    mockNativeAuthInstance.currentUser = user;

    const transaction = await sendPhoneLinkVerificationCode('+919999999999');
    const result = await linkWithPhoneVerificationCode(
      transaction.verificationId,
      '123456',
      transaction.expectedUid,
    );

    expect(transaction.expectedUid).toBe(user.uid);
    expect(user.linkWithCredential).toHaveBeenCalledWith(mockPhoneCredential);
    expect(user.getIdTokenResult).toHaveBeenCalledWith(true);
    expect(result.user.uid).toBe(user.uid);
    expect(result.user.providerData).toEqual(
      expect.arrayContaining([{ providerId }, { providerId: 'phone' }]),
    );
    expect(mockNativeAuthInstance.currentUser.uid).toBe(user.uid);
    expect(mockNativeAuthInstance.signInWithCredential).not.toHaveBeenCalled();
  });
});

describe('phone-link integrity failures', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNativeAuthInstance.currentUser = null;
    mockNativeAuthInstance.verifyPhoneNumber.mockResolvedValue({
      verificationId: 'verification-id',
    });
  });

  it('stops when the signed-in account changes while sending the OTP', async () => {
    const original = providerUser('google.com');
    mockNativeAuthInstance.currentUser = original;
    mockNativeAuthInstance.verifyPhoneNumber.mockImplementationOnce(async () => {
      mockNativeAuthInstance.currentUser = providerUser('apple.com');
      return { verificationId: 'verification-id' };
    });

    await expect(sendPhoneLinkVerificationCode('+919999999999')).rejects.toMatchObject({
      code: 'auth/phone-link-integrity-check-failed',
    });
  });

  it('stops before linking when the stored UID does not match the current user', async () => {
    const user = providerUser('google.com');
    mockNativeAuthInstance.currentUser = user;

    await expect(
      linkWithPhoneVerificationCode('verification-id', '123456', 'different-uid'),
    ).rejects.toMatchObject({ code: 'auth/phone-link-integrity-check-failed' });
    expect(user.linkWithCredential).not.toHaveBeenCalled();
  });

  it('stops an OTP resend when the transaction belongs to another UID', async () => {
    const user = providerUser('google.com');
    mockNativeAuthInstance.currentUser = user;

    await expect(
      sendPhoneLinkVerificationCode('+919999999999', 'original-transaction-uid'),
    ).rejects.toMatchObject({ code: 'auth/phone-link-integrity-check-failed' });
    expect(mockNativeAuthInstance.verifyPhoneNumber).not.toHaveBeenCalled();
  });

  it('rejects a link result belonging to another UID', async () => {
    const user = providerUser('google.com');
    const switchedUser = providerUser('apple.com');
    user.linkWithCredential.mockResolvedValueOnce({ user: switchedUser });
    mockNativeAuthInstance.currentUser = user;

    await expect(
      linkWithPhoneVerificationCode('verification-id', '123456', user.uid),
    ).rejects.toMatchObject({ code: 'auth/phone-link-integrity-check-failed' });
    expect(user.getIdTokenResult).not.toHaveBeenCalled();
  });

  it('does not sign into the account that already owns the phone credential', async () => {
    const user = providerUser('google.com');
    user.linkWithCredential.mockRejectedValueOnce({
      code: 'auth/credential-already-in-use',
      message: 'Phone number belongs to another account',
    });
    mockNativeAuthInstance.currentUser = user;

    await expect(
      linkWithPhoneVerificationCode('verification-id', '123456', user.uid),
    ).rejects.toMatchObject({ code: 'auth/credential-already-in-use' });
    expect(mockNativeAuthInstance.signInWithCredential).not.toHaveBeenCalled();
    expect(mockNativeAuthInstance.currentUser.uid).toBe(user.uid);
  });

  it('rejects a refreshed Firebase token belonging to another UID', async () => {
    const user = providerUser('google.com');
    user.getIdTokenResult.mockResolvedValueOnce({ claims: { sub: 'different-uid' } });
    mockNativeAuthInstance.currentUser = user;

    await expect(
      linkWithPhoneVerificationCode('verification-id', '123456', user.uid),
    ).rejects.toMatchObject({ code: 'auth/phone-link-integrity-check-failed' });
  });

  it('rejects an account switch that occurs during token refresh', async () => {
    const user = providerUser('google.com');
    user.getIdTokenResult.mockImplementationOnce(async () => {
      mockNativeAuthInstance.currentUser = providerUser('apple.com');
      return { claims: { sub: user.uid } };
    });
    mockNativeAuthInstance.currentUser = user;

    await expect(
      linkWithPhoneVerificationCode('verification-id', '123456', user.uid),
    ).rejects.toMatchObject({ code: 'auth/phone-link-integrity-check-failed' });
  });

  it('rejects a link result that drops the original provider', async () => {
    const user = providerUser('google.com');
    const resultUser = {
      ...user,
      providerData: [{ providerId: 'phone' }],
    };
    user.linkWithCredential.mockResolvedValueOnce({ user: resultUser });
    mockNativeAuthInstance.currentUser = user;

    await expect(
      linkWithPhoneVerificationCode('verification-id', '123456', user.uid),
    ).rejects.toMatchObject({ code: 'auth/phone-link-integrity-check-failed' });
  });
});
