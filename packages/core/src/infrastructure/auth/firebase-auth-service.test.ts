import { describe, expect, it, vi } from 'vitest';
import { FirebaseAuthService } from './firebase-auth-service.js';

describe('FirebaseAuthService credential boundaries', () => {
  it('verifies bearer credentials only as revoked-checked ID tokens', async () => {
    const auth = {
      verifyIdToken: vi.fn().mockResolvedValue({ uid: 'user-1' }),
      verifySessionCookie: vi.fn(),
    };
    const service = new FirebaseAuthService(auth as any);

    const result = await service.verifyTokenDetailed('id-token', 'id_token');

    expect(auth.verifyIdToken).toHaveBeenCalledWith('id-token', true);
    expect(auth.verifySessionCookie).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 'valid',
      source: 'id_token',
      revokedChecked: true,
      disabledChecked: true,
    });
  });

  it('verifies cookie credentials only as revoked-checked session cookies', async () => {
    const auth = {
      verifyIdToken: vi.fn(),
      verifySessionCookie: vi.fn().mockResolvedValue({ uid: 'user-2' }),
    };
    const service = new FirebaseAuthService(auth as any);

    const result = await service.verifyTokenDetailed('session-cookie', 'session_cookie');

    expect(auth.verifySessionCookie).toHaveBeenCalledWith('session-cookie', true);
    expect(auth.verifyIdToken).not.toHaveBeenCalled();
    expect(result.source).toBe('session_cookie');
  });

  it('short-caches only a successful revoked-checked verification', async () => {
    const auth = {
      verifyIdToken: vi.fn().mockResolvedValue({ uid: 'user-cache' }),
      verifySessionCookie: vi.fn(),
    };
    const service = new FirebaseAuthService(auth as any, 5_000);

    const first = await service.verifyTokenDetailed('cached-id-token', 'id_token');
    const second = await service.verifyTokenDetailed('cached-id-token', 'id_token');

    expect(first).toEqual(second);
    expect(auth.verifyIdToken).toHaveBeenCalledTimes(1);
    expect(auth.verifyIdToken).toHaveBeenCalledWith('cached-id-token', true);
  });

  it('keeps the default positive verification cache alive through one checkout window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-28T12:00:00.000Z'));
    const auth = {
      verifyIdToken: vi.fn().mockResolvedValue({ uid: 'user-checkout' }),
      verifySessionCookie: vi.fn(),
    };
    const service = new FirebaseAuthService(auth as any);

    try {
      await service.verifyTokenDetailed('checkout-token', 'id_token');
      vi.advanceTimersByTime(29_000);
      await service.verifyTokenDetailed('checkout-token', 'id_token');
      expect(auth.verifyIdToken).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1_001);
      await service.verifyTokenDetailed('checkout-token', 'id_token');
      expect(auth.verifyIdToken).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('never caches a failed credential verification', async () => {
    const auth = {
      verifyIdToken: vi
        .fn()
        .mockRejectedValue(Object.assign(new Error('revoked'), { code: 'auth/id-token-revoked' })),
      verifySessionCookie: vi.fn(),
    };
    const service = new FirebaseAuthService(auth as any, 5_000);

    await service.verifyTokenDetailed('revoked-token', 'id_token');
    await service.verifyTokenDetailed('revoked-token', 'id_token');

    expect(auth.verifyIdToken).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['auth/id-token-revoked', 'revoked'],
    ['auth/user-disabled', 'disabled'],
    ['auth/id-token-expired', 'expired'],
    ['auth/invalid-id-token', 'credential_mismatch'],
  ])('maps %s to %s without trying another credential verifier', async (code, status) => {
    const auth = {
      verifyIdToken: vi.fn().mockRejectedValue(Object.assign(new Error(code), { code })),
      verifySessionCookie: vi.fn(),
    };
    const service = new FirebaseAuthService(auth as any);

    const result = await service.verifyTokenDetailed('bad-token', 'id_token');

    expect(result.status).toBe(status);
    expect(auth.verifySessionCookie).not.toHaveBeenCalled();
  });
});
