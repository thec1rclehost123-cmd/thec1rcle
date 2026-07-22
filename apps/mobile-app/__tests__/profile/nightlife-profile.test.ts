import {
  isActiveNightlifeProfileEditor,
  isNightlifeDraftOwnedBy,
  pauseActiveNightlifeProfile,
} from '@/lib/nightlifeProfile';

describe('isActiveNightlifeProfileEditor', () => {
  it('keeps an explicitly active editor visible after partial hydration omits datingActive', () => {
    expect(
      isActiveNightlifeProfileEditor({
        routeMode: 'edit',
        datingActive: undefined,
      }),
    ).toBe(true);
  });

  it('does not expose pause in first-time creation or a paused re-enable flow', () => {
    expect(isActiveNightlifeProfileEditor({ datingActive: undefined })).toBe(false);
    expect(isActiveNightlifeProfileEditor({ datingActive: false })).toBe(false);
  });

  it('supports legacy active editor links while the canonical profile is active', () => {
    expect(isActiveNightlifeProfileEditor({ datingActive: true })).toBe(true);
  });
});

describe('isNightlifeDraftOwnedBy', () => {
  it('allows only the authenticated owner to resume a persisted draft', () => {
    expect(isNightlifeDraftOwnedBy('user-a', 'user-a')).toBe(true);
    expect(isNightlifeDraftOwnedBy('user-b', 'user-a')).toBe(false);
    expect(isNightlifeDraftOwnedBy(null, 'user-a')).toBe(false);
    expect(isNightlifeDraftOwnedBy('user-a', null)).toBe(false);
  });
});

describe('pauseActiveNightlifeProfile', () => {
  it('only disables discovery so saved Nightlife profile fields stay intact', async () => {
    const updateProfile = jest.fn().mockResolvedValue(true);

    const result = await pauseActiveNightlifeProfile({
      userId: 'user_1',
      updateProfile,
    });

    expect(result).toEqual({ ok: true });
    expect(updateProfile).toHaveBeenCalledTimes(1);
    expect(updateProfile).toHaveBeenCalledWith('user_1', { datingActive: false });
  });

  it('returns the store error and allows the editor to stay open for retry', async () => {
    const updateProfile = jest.fn().mockResolvedValue(false);

    const result = await pauseActiveNightlifeProfile({
      userId: 'user_1',
      updateProfile,
      getStoreError: () => 'Network request failed',
    });

    expect(result).toEqual({ ok: false, error: 'Network request failed' });
  });

  it('returns an unexpected request error instead of reporting success', async () => {
    const updateProfile = jest.fn().mockRejectedValue(new Error('Gateway unavailable'));

    const result = await pauseActiveNightlifeProfile({
      userId: 'user_1',
      updateProfile,
    });

    expect(result).toEqual({ ok: false, error: 'Gateway unavailable' });
  });
});
