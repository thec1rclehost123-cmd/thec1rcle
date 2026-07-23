const mockLogout = jest.fn();
const mockRevokePushToken = jest.fn();

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn(),
  completeAuthSessionAfterSignIn: jest.fn(),
}));

jest.mock('@/lib/firebase', () => ({
  loginWithEmail: jest.fn(),
  signupWithEmail: jest.fn(),
  logout: (...args: any[]) => mockLogout(...args),
  resetPassword: jest.fn(),
  loginWithApple: jest.fn(),
  loginWithGoogle: jest.fn(),
  loginWithPhoneVerificationCode: jest.fn(),
  sendPhoneVerificationCode: jest.fn(),
  sendPhoneLinkVerificationCode: jest.fn(),
  sendVerificationEmail: jest.fn(),
  getPendingProviderLink: jest.fn(),
  linkWithPhoneVerificationCode: jest.fn(),
  linkEmailToUser: jest.fn(),
  sendVerificationLinkToCurrentUser: jest.fn(),
}));

jest.mock('@/lib/notifications', () => ({
  revokePushToken: (...args: any[]) => mockRevokePushToken(...args),
}));

import { performSignOut } from '@/hooks/useAuth';

describe('performSignOut', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRevokePushToken.mockResolvedValue(true);
    mockLogout.mockResolvedValue(undefined);
  });

  it('revokes the account push token before Firebase logout', async () => {
    const order: string[] = [];
    mockRevokePushToken.mockImplementation(async () => {
      order.push('revoke');
      return true;
    });
    mockLogout.mockImplementation(async () => {
      order.push('logout');
    });

    await performSignOut('user-a');

    expect(mockRevokePushToken).toHaveBeenCalledWith('user-a');
    expect(order).toEqual(['revoke', 'logout']);
  });

  it('still logs out if best-effort token revocation throws', async () => {
    mockRevokePushToken.mockRejectedValue(new Error('gateway offline'));

    await expect(performSignOut('user-a')).resolves.toBeUndefined();

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('skips revocation when there is no authenticated account', async () => {
    await performSignOut(null);

    expect(mockRevokePushToken).not.toHaveBeenCalled();
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
