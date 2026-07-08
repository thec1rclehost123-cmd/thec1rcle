process.env.EXPO_PUBLIC_FIREBASE_API_KEY = 'test-firebase-api-key';
process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN = 'test.firebaseapp.com';
process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'test-project';
process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET = 'test.appspot.com';
process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = '000000000000';
process.env.EXPO_PUBLIC_FIREBASE_APP_ID = '1:000000000000:web:abcdef';
process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID = 'rzp_test_xxxxxxxxxxxx';
process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3005';
process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://key@o0.ingest.sentry.io/0';

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

const mockAuthInstance = {
  onAuthStateChanged: jest.fn(() => jest.fn()),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  currentUser: null,
  applyActionCode: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  signInWithPhoneNumber: jest.fn(),
  signInWithCredential: jest.fn(),
  fetchSignInMethodsForEmail: jest.fn().mockResolvedValue([]),
  AppleAuthProvider: { credential: jest.fn() },
  GoogleAuthProvider: { credential: jest.fn() },
  PhoneAuthProvider: { credential: jest.fn() },
};

jest.mock(
  '@react-native-firebase/auth',
  () => {
    const authFn = jest.fn(() => mockAuthInstance);
    authFn.AppleAuthProvider = { credential: jest.fn() };
    authFn.GoogleAuthProvider = { credential: jest.fn() };
    authFn.PhoneAuthProvider = { credential: jest.fn() };
    return {
      __esModule: true,
      default: authFn,
      FirebaseAuthTypes: {},
    };
  },
  { virtual: true },
);

jest.mock(
  '@react-native-firebase/app',
  () => ({
    default: jest.fn(),
  }),
  { virtual: true },
);

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
