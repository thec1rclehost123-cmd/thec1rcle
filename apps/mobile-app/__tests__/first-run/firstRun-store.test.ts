const mockApiFetch = jest.fn();
let mockCurrentUser: { uid: string } | null = { uid: 'user_revisit' };

jest.mock('@/lib/api', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

jest.mock('@/lib/firebase', () => ({
  getFirebaseAuth: () => ({ currentUser: mockCurrentUser }),
}));

jest.mock('@/lib/firstRunPerformance', () => ({
  startFirstRunMetric: jest.fn(),
  finishFirstRunMetric: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FirstRunSnapshot } from '@/lib/firstRun';
import { useFirstRunStore } from '@/store/firstRunStore';

const completeSnapshot: FirstRunSnapshot = {
  version: 2,
  currentStage: 'complete',
  completed: true,
  displayName: 'Aayush',
  dateOfBirth: '2000-01-01',
  cityId: 'pune',
  cityName: 'Pune',
  vibeTags: ['clubs', 'live_music', 'lounges'],
  intents: ['discover'],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('firstRunStore canonical snapshot compatibility', () => {
  beforeEach(async () => {
    mockApiFetch.mockReset();
    mockCurrentUser = { uid: 'user_revisit' };
    await AsyncStorage.clear();
    useFirstRunStore.setState({
      snapshot: null,
      loading: false,
      hydrated: false,
      error: null,
    });
  });

  it('hydrates all revisit fields from the canonical relaunch bootstrap', async () => {
    mockApiFetch.mockResolvedValueOnce({
      success: true,
      snapshot: completeSnapshot,
      requirements: { minimumAccountAge: 21 },
    });

    await useFirstRunStore.getState().load();

    expect(useFirstRunStore.getState()).toMatchObject({
      hydrated: true,
      loading: false,
      error: null,
      snapshot: { ...completeSnapshot, minimumAccountAge: 21 },
    });
    expect(mockApiFetch).toHaveBeenCalledWith('/api/v1/users/me/onboarding', {
      method: 'GET',
    });
  });

  it('restores the same user-scoped snapshot for an offline direct revisit', async () => {
    await AsyncStorage.setItem(
      'c1rcle:first_run:v2:user_revisit',
      JSON.stringify(completeSnapshot),
    );
    mockApiFetch.mockRejectedValueOnce(new Error('offline'));

    await useFirstRunStore.getState().load();

    expect(useFirstRunStore.getState()).toMatchObject({
      hydrated: true,
      error: null,
      snapshot: completeSnapshot,
    });
  });

  it('does not erase saved identity, city, or tastes on a metadata-only legacy response', async () => {
    useFirstRunStore.setState({ snapshot: { ...completeSnapshot, currentStage: 'tastes' } });
    mockApiFetch.mockResolvedValueOnce({
      onboarding: { version: 2, currentStage: 'intent', completed: false },
    });

    await expect(
      useFirstRunStore.getState().savePreferences({
        vibeTags: ['clubs', 'live_music', 'lounges'],
      }),
    ).resolves.toBe(true);

    expect(useFirstRunStore.getState().snapshot).toMatchObject({
      displayName: 'Aayush',
      dateOfBirth: '2000-01-01',
      cityId: 'pune',
      cityName: 'Pune',
      vibeTags: ['clubs', 'live_music', 'lounges'],
      intents: ['discover'],
      currentStage: 'intent',
    });
  });

  it('rejects a returning-user bootstrap response after an account switch', async () => {
    const userAResponse = deferred<any>();
    const userBResponse = deferred<any>();
    mockApiFetch
      .mockReturnValueOnce(userAResponse.promise)
      .mockReturnValueOnce(userBResponse.promise);

    mockCurrentUser = { uid: 'user-a' };
    const loadA = useFirstRunStore.getState().load();
    await Promise.resolve();
    await Promise.resolve();

    mockCurrentUser = null;
    useFirstRunStore.getState().clear();
    mockCurrentUser = { uid: 'user-b' };
    const loadB = useFirstRunStore.getState().load();
    await Promise.resolve();
    await Promise.resolve();

    userBResponse.resolve({
      snapshot: { ...completeSnapshot, displayName: 'User B', cityId: 'mumbai', cityName: 'Mumbai' },
    });
    await loadB;
    userAResponse.resolve({
      snapshot: { ...completeSnapshot, displayName: 'User A', cityId: 'pune', cityName: 'Pune' },
    });
    await loadA;

    expect(useFirstRunStore.getState()).toMatchObject({
      hydrated: true,
      loading: false,
      snapshot: expect.objectContaining({ displayName: 'User B', cityName: 'Mumbai' }),
    });
    await expect(AsyncStorage.getItem('c1rcle:first_run:v2:user-a')).resolves.toBeNull();
    await expect(AsyncStorage.getItem('c1rcle:first_run:v2:user-b')).resolves.not.toBeNull();
  });
});
