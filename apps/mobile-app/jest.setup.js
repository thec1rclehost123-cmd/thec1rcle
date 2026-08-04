/* global jest */
import fetchMockLib from 'jest-fetch-mock';
fetchMockLib.enableMocks();
global.fetchMock = fetchMockLib;

global.__DEV__ = true;

jest.mock(
  'expo-haptics',
  () => ({
    notificationAsync: jest.fn(),
    impactAsync: jest.fn(),
    NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
    ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  }),
  { virtual: true },
);

jest.mock(
  'expo-router',
  () => ({
    router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
    useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
    useFocusEffect: (cb) => {
      cb();
    },
  }),
  { virtual: true },
);

jest.mock(
  'expo-secure-store',
  () => ({
    setItemAsync: jest.fn().mockResolvedValue(undefined),
    getItemAsync: jest.fn().mockResolvedValue(null),
    deleteItemAsync: jest.fn().mockResolvedValue(undefined),
  }),
  { virtual: true },
);

const mockAsyncStorage = new Map();
jest.mock(
  '@react-native-async-storage/async-storage',
  () => ({
    setItem: jest.fn(async (key, value) => {
      mockAsyncStorage.set(key, value);
    }),
    getItem: jest.fn(async (key) => mockAsyncStorage.get(key) ?? null),
    removeItem: jest.fn(async (key) => {
      mockAsyncStorage.delete(key);
    }),
    getAllKeys: jest.fn(async () => Array.from(mockAsyncStorage.keys())),
    multiRemove: jest.fn(async (keys) => {
      keys.forEach((key) => mockAsyncStorage.delete(key));
    }),
    clear: jest.fn(async () => {
      mockAsyncStorage.clear();
    }),
  }),
  { virtual: true },
);

jest.mock(
  '@sentry/react-native',
  () => ({
    init: jest.fn(),
    captureException: jest.fn(),
    setTag: jest.fn(),
    setUser: jest.fn(),
  }),
  { virtual: true },
);

jest.mock('react-native-css-interop/jsx-runtime', () => require('react/jsx-runtime'));
jest.mock('react-native-css-interop/jsx-dev-runtime', () => require('react/jsx-dev-runtime'));
jest.mock('react-native-css-interop', () => ({
  cssInterop: jest.fn(),
  remapProps: jest.fn(),
  createInteropElement: require('react').createElement,
}));

jest.mock(
  'expo-crypto',
  () => ({
    randomUUID: () => 'test-uuid-1234-5678-abcd-efgh',
  }),
  { virtual: true },
);

jest.mock(
  'expo-network',
  () => ({
    getNetworkStateAsync: jest.fn().mockResolvedValue({ isConnected: true }),
  }),
  { virtual: true },
);

jest.mock(
  'expo-constants',
  () => ({
    platform: { os: 'ios' },
    installationId: 'test-install-id',
  }),
  { virtual: true },
);

jest.mock(
  '@react-native-firebase/auth',
  () => ({
    __esModule: true,
    default: () => ({
      currentUser: null,
      onAuthStateChanged: jest.fn(),
      signInWithCredential: jest.fn(),
    }),
    FirebaseAuthTypes: {},
  }),
  { virtual: true },
);

jest.mock(
  '@react-native-firebase/app',
  () => ({
    __esModule: true,
    default: {
      app: jest.fn(),
    },
  }),
  { virtual: true },
);

jest.mock(
  'expo-notifications',
  () => ({
    getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'mock-push-token' }),
    addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
    addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
    setNotificationHandler: jest.fn(),
  }),
  { virtual: true },
);

jest.mock(
  'expo-device',
  () => ({
    isDevice: true,
  }),
  { virtual: true },
);
