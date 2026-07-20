import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateLegacyFirstRunStorage } from '@/lib/boot/legacyFirstRunStorage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  multiGet: jest.fn(),
  multiRemove: jest.fn(),
  setItem: jest.fn(),
}));

describe('legacy first-run local storage migration', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads and removes obsolete keys once for the canonical user', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    await expect(migrateLegacyFirstRunStorage('user_1')).resolves.toBe(true);
    expect(AsyncStorage.multiGet).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(
      expect.arrayContaining([
        'c1rcle_onboarding_complete',
        'c1rcle_onboarding_complete:user_1',
        'profileSetupJustCompleted_user_1',
      ]),
    );
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'c1rcle:first_run:local_migration:2:user_1',
      'done',
    );
  });

  it('does nothing after the per-user marker exists', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('done');
    await expect(migrateLegacyFirstRunStorage('user_1')).resolves.toBe(false);
    expect(AsyncStorage.multiGet).not.toHaveBeenCalled();
    expect(AsyncStorage.multiRemove).not.toHaveBeenCalled();
  });
});
