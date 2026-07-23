const mockGetForegroundPermissions = jest.fn();
const mockRequestForegroundPermissions = jest.fn();

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: (...args: unknown[]) => mockGetForegroundPermissions(...args),
  requestForegroundPermissionsAsync: (...args: unknown[]) =>
    mockRequestForegroundPermissions(...args),
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
}));

jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
  Linking: { openSettings: jest.fn() },
  Platform: { OS: 'android' },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
  },
}));

import { requestLocationSystemPermission } from '../../lib/permissions';

describe('location permission recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns immediately when location is already granted', async () => {
    mockGetForegroundPermissions.mockResolvedValue({ status: 'granted', canAskAgain: true });

    await expect(requestLocationSystemPermission()).resolves.toBe(true);
    expect(mockRequestForegroundPermissions).not.toHaveBeenCalled();
  });

  it('requests location only after the explicit caller action', async () => {
    mockGetForegroundPermissions.mockResolvedValue({ status: 'undetermined', canAskAgain: true });
    mockRequestForegroundPermissions.mockResolvedValue({ status: 'granted' });

    await expect(requestLocationSystemPermission()).resolves.toBe(true);
    expect(mockRequestForegroundPermissions).toHaveBeenCalledTimes(1);
  });

  it('does not reopen a system prompt after permanent denial', async () => {
    mockGetForegroundPermissions.mockResolvedValue({ status: 'denied', canAskAgain: false });

    await expect(requestLocationSystemPermission()).resolves.toBe(false);
    expect(mockRequestForegroundPermissions).not.toHaveBeenCalled();
  });

  it('fails closed when the native permission API throws', async () => {
    mockGetForegroundPermissions.mockRejectedValue(new Error('native permission failure'));

    await expect(requestLocationSystemPermission()).resolves.toBe(false);
  });
});
