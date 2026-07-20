const mockUpdateProfile = jest.fn();

jest.mock('../../store/profileStore', () => ({
  useProfileStore: {
    getState: () => ({ updateProfile: mockUpdateProfile }),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

import { useNightlifeSetupStore } from '../../store/nightlifeSetupStore';

describe('Nightlife onboarding draft ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useNightlifeSetupStore.getState().reset();
  });

  it('preserves the same account draft when onboarding is resumed', () => {
    useNightlifeSetupStore.getState().startForUser('user-a', {
      vitals: { height: `5'8"` },
      nightlifeVibeTags: ['House'],
    });
    useNightlifeSetupStore.getState().setNightlifeVibeTags(['House', 'Techno']);

    useNightlifeSetupStore.getState().startForUser('user-a', {
      nightlifeVibeTags: ['Bollywood'],
    });

    expect(useNightlifeSetupStore.getState()).toMatchObject({
      ownerUserId: 'user-a',
      nightlifeVibeTags: ['House', 'Techno'],
      vitals: { height: `5'8"` },
    });
  });

  it('replaces the draft when a different account starts onboarding', () => {
    useNightlifeSetupStore.getState().startForUser('user-a', {
      prompts: [
        { promptId: 'a', question: 'A?', answer: 'A', type: 'text' },
      ],
      datingPhotos: ['https://cdn.example/user-a.jpg'],
    });

    useNightlifeSetupStore.getState().startForUser('user-b', {
      datingPhotos: ['https://cdn.example/user-b.jpg'],
    });

    expect(useNightlifeSetupStore.getState()).toMatchObject({
      ownerUserId: 'user-b',
      prompts: [],
      datingPhotos: ['https://cdn.example/user-b.jpg'],
      nightlifeVibeTags: [],
    });
  });

  it('refuses to commit another account draft', async () => {
    useNightlifeSetupStore.getState().startForUser('user-a', {
      datingPhotos: ['https://cdn.example/user-a.jpg'],
    });

    await expect(useNightlifeSetupStore.getState().commitToProfile('user-b')).resolves.toBe(false);
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it('keeps the draft available when the profile save fails', async () => {
    mockUpdateProfile.mockResolvedValue(false);
    useNightlifeSetupStore.getState().startForUser('user-a', {
      datingPhotos: ['https://cdn.example/user-a.jpg'],
      nightlifeVibeTags: ['House'],
    });

    await expect(useNightlifeSetupStore.getState().commitToProfile('user-a')).resolves.toBe(false);
    expect(useNightlifeSetupStore.getState()).toMatchObject({
      ownerUserId: 'user-a',
      datingPhotos: ['https://cdn.example/user-a.jpg'],
      nightlifeVibeTags: ['House'],
    });
  });
});
