import { describe, expect, it, vi } from 'vitest';
import { getCachedFirebaseIdToken } from './getCachedFirebaseIdToken';

describe('getCachedFirebaseIdToken', () => {
  it('uses the Firebase cached-token path without forcing a refresh', async () => {
    const getIdToken = vi.fn().mockResolvedValue('cached-token');

    await expect(getCachedFirebaseIdToken({ getIdToken })).resolves.toBe('cached-token');
    expect(getIdToken).toHaveBeenCalledTimes(1);
    expect(getIdToken).toHaveBeenCalledWith();
  });

  it('returns an empty credential when no user is signed in', async () => {
    await expect(getCachedFirebaseIdToken(null)).resolves.toBe('');
  });
});
