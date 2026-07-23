const mockGetPermissions = jest.fn();
const mockRequestPermissions = jest.fn();
const mockGetExpoPushToken = jest.fn();
const mockSetChannel = jest.fn();
const mockAsyncGetItem = jest.fn();
const mockAsyncSetItem = jest.fn();
const mockAsyncRemoveItem = jest.fn();
const mockApiFetch = jest.fn();

jest.mock('expo-notifications', () => ({
  AndroidImportance: { MAX: 5 },
  getPermissionsAsync: (...args: any[]) => mockGetPermissions(...args),
  requestPermissionsAsync: (...args: any[]) => mockRequestPermissions(...args),
  getExpoPushTokenAsync: (...args: any[]) => mockGetExpoPushToken(...args),
  setNotificationChannelAsync: (...args: any[]) => mockSetChannel(...args),
  setNotificationHandler: jest.fn(),
}));

jest.mock('expo-device', () => ({
  isDevice: true,
  osBuildId: 'test-build',
  modelId: 'test-device',
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      version: '1.0.0',
      extra: { eas: { projectId: 'test-project' } },
    },
  },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (...args: any[]) => mockAsyncGetItem(...args),
    setItem: (...args: any[]) => mockAsyncSetItem(...args),
    removeItem: (...args: any[]) => mockAsyncRemoveItem(...args),
  },
}));

jest.mock('../../lib/api', () => ({
  apiFetch: (...args: any[]) => mockApiFetch(...args),
}));

import {
  getExpoPushToken,
  registerPushToken,
  refreshPushToken,
  requestNotificationPermissions,
  revokePushToken,
} from '../../lib/notifications';

describe('notification permission consent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetChannel.mockResolvedValue(undefined);
    mockGetExpoPushToken.mockResolvedValue({ data: 'ExponentPushToken[test]' });
    mockAsyncGetItem.mockResolvedValue(null);
    mockAsyncSetItem.mockResolvedValue(undefined);
    mockAsyncRemoveItem.mockResolvedValue(undefined);
    mockApiFetch.mockResolvedValue({});
  });

  it('does not open the system prompt during a background token refresh', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'denied', canAskAgain: true });

    await refreshPushToken('user-1');

    expect(mockRequestPermissions).not.toHaveBeenCalled();
    expect(mockGetExpoPushToken).not.toHaveBeenCalled();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('requests permission only when explicitly requested', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'denied', canAskAgain: true });
    mockRequestPermissions.mockResolvedValue({ status: 'granted' });

    const result = await getExpoPushToken({ requestPermission: true });

    expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
    expect(mockGetExpoPushToken).toHaveBeenCalledWith({ projectId: 'test-project' });
    expect(result).toEqual({ token: 'ExponentPushToken[test]' });
  });

  it('does not re-request after the operating system marks the denial permanent', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'denied', canAskAgain: false });

    const granted = await requestNotificationPermissions();

    expect(granted).toBe(false);
    expect(mockRequestPermissions).not.toHaveBeenCalled();
  });

  it('can retry gateway registration when system permission is already granted', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'granted', canAskAgain: true });

    await expect(
      registerPushToken('user-1', { requestPermission: false }),
    ).resolves.toBe(true);

    expect(mockRequestPermissions).not.toHaveBeenCalled();
    expect(mockGetExpoPushToken).toHaveBeenCalledWith({ projectId: 'test-project' });
    expect(mockApiFetch).toHaveBeenCalledWith('/api/v1/users/me/device-token', {
      method: 'POST',
      body: expect.any(String),
      requireAuth: true,
    });
    expect(mockAsyncSetItem).toHaveBeenCalledWith(
      '@c1rcle/pushToken:user-1',
      'ExponentPushToken[test]',
    );
  });

  it('registers the same physical token again after an account switch', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'granted', canAskAgain: true });
    mockAsyncGetItem.mockResolvedValue(null);

    await refreshPushToken('user-a');
    await refreshPushToken('user-b');

    expect(mockAsyncGetItem).toHaveBeenNthCalledWith(1, '@c1rcle/pushToken:user-a');
    expect(mockAsyncGetItem).toHaveBeenNthCalledWith(2, '@c1rcle/pushToken:user-b');
    expect(mockApiFetch).toHaveBeenCalledTimes(2);
  });

  it('revokes the stored token and clears only the signing-out account token', async () => {
    mockAsyncGetItem.mockResolvedValue('ExponentPushToken[stored]');

    await expect(revokePushToken('user-a')).resolves.toBe(true);

    expect(mockApiFetch).toHaveBeenCalledWith('/api/v1/users/me/device-token', {
      method: 'DELETE',
      body: JSON.stringify({
        token: 'ExponentPushToken[stored]',
        deviceId: 'android-test-build',
      }),
      requireAuth: true,
    });
    expect(mockAsyncRemoveItem).toHaveBeenCalledTimes(1);
    expect(mockAsyncRemoveItem).toHaveBeenCalledWith('@c1rcle/pushToken:user-a');
    expect(mockAsyncRemoveItem).not.toHaveBeenCalledWith('@c1rcle/pushToken:user-b');
  });

  it('falls back to the current Expo token without opening the permission prompt', async () => {
    mockAsyncGetItem.mockResolvedValue(null);
    mockGetPermissions.mockResolvedValue({ status: 'granted', canAskAgain: true });

    await expect(revokePushToken('user-a')).resolves.toBe(true);

    expect(mockRequestPermissions).not.toHaveBeenCalled();
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/v1/users/me/device-token',
      expect.objectContaining({ method: 'DELETE', requireAuth: true }),
    );
  });

  it('clears the account-scoped local token when remote revocation fails', async () => {
    mockAsyncGetItem.mockResolvedValue('ExponentPushToken[stored]');
    mockApiFetch.mockRejectedValue(new Error('gateway offline'));

    await expect(revokePushToken('user-a')).resolves.toBe(false);

    expect(mockAsyncRemoveItem).toHaveBeenCalledWith('@c1rcle/pushToken:user-a');
  });

  it('bounds remote revocation so logout callers are not held indefinitely', async () => {
    jest.useFakeTimers();
    mockAsyncGetItem.mockResolvedValue('ExponentPushToken[stored]');
    mockApiFetch.mockReturnValue(new Promise(() => {}));

    const revoke = revokePushToken('user-a', { timeoutMs: 25 });
    await Promise.resolve();
    jest.advanceTimersByTime(25);

    await expect(revoke).resolves.toBe(false);
    expect(mockAsyncRemoveItem).toHaveBeenCalledWith('@c1rcle/pushToken:user-a');
    jest.useRealTimers();
  });
});
