import fetchMockLib from 'jest-fetch-mock';
fetchMockLib.enableMocks();
global.fetchMock = fetchMockLib;

global.__DEV__ = true;

jest.mock('expo-haptics', () => ({
    notificationAsync: jest.fn(),
    impactAsync: jest.fn(),
    NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
    ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}), { virtual: true });

jest.mock('expo-router', () => ({
    router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
    useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
    useFocusEffect: (cb) => { cb(); },
}), { virtual: true });

jest.mock('expo-secure-store', () => ({
    setItemAsync: jest.fn().mockResolvedValue(undefined),
    getItemAsync: jest.fn().mockResolvedValue(null),
    deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}), { virtual: true });

jest.mock('expo-crypto', () => ({
    randomUUID: () => 'test-uuid-1234-5678-abcd-efgh',
}), { virtual: true });

jest.mock('expo-network', () => ({
    getNetworkStateAsync: jest.fn().mockResolvedValue({ isConnected: true }),
}), { virtual: true });

jest.mock('expo-constants', () => ({
    platform: { os: 'ios' },
    installationId: 'test-install-id',
}), { virtual: true });
