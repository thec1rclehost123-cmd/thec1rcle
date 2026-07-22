import { describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const mockDecodedToken = {
  uid: 'admin_1',
  role: 'admin',
  admin_role: 'super',
  admin: true,
  auth_time: Math.floor(Date.now() / 1000) - 60,
};

vi.mock('@/lib/firebase/admin', () => ({ getAdminApp: vi.fn(() => ({})) }));
vi.mock('firebase-admin/auth', () => ({ getAuth: vi.fn(() => ({ verifyIdToken: vi.fn() })) }));
vi.mock('@c1rcle/core/security-state', () => ({
  isAdminSuspended: vi.fn().mockResolvedValue({ suspended: false }),
  checkCriticalEndpoint: vi.fn(() => ({ allowed: true, degraded: false })),
}));
vi.mock('./logger', () => ({ logAuthEvent: vi.fn() }));

const { withAdminAuth } = await import('./adminMiddleware');

function mockRequest(authHeader) {
  return {
    headers: {
      get: (k) =>
        ({
          authorization: authHeader,
          'user-agent': 'test-agent',
          accept: '*/*',
          'accept-language': 'en',
          'accept-encoding': 'gzip',
          'sec-ch-ua': '"Test"',
          'x-real-ip': '127.0.0.1',
          'x-forwarded-for': '127.0.0.1',
          'x-request-id': 'req_123',
        })[k] || null,
    },
    nextUrl: { pathname: '/api/test' },
  };
}

describe('withAdminAuth', () => {
  it('returns 404 when authorization header is missing', async () => {
    const handler = vi.fn();
    const res = await withAdminAuth(handler)(mockRequest(null));
    expect(res.status).toBe(404);
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 404 when authorization header is not Bearer', async () => {
    const handler = vi.fn();
    const res = await withAdminAuth(handler)(mockRequest('Basic token123'));
    expect(res.status).toBe(404);
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 404 when token verification fails', async () => {
    const { getAuth } = await import('firebase-admin/auth');
    getAuth.mockReturnValue({ verifyIdToken: vi.fn().mockRejectedValue(new Error('Token expired')) });
    const handler = vi.fn();
    const res = await withAdminAuth(handler)(mockRequest('Bearer invalid_token'));
    expect(res.status).toBe(404);
    expect(handler).not.toHaveBeenCalled();
  });

  it('passes through to handler when token is valid', async () => {
    const { getAuth } = await import('firebase-admin/auth');
    getAuth.mockReturnValue({ verifyIdToken: vi.fn().mockResolvedValue(mockDecodedToken) });
    const handler = vi.fn().mockReturnValue(NextResponse.json({ ok: true }));
    const req = mockRequest('Bearer valid_token');
    const res = await withAdminAuth(handler)(req);
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(req.user).toBeDefined();
    expect(req.user.uid).toBe('admin_1');
    expect(req.user.admin_role).toBe('super');
  });

  it('rejects suspended admins', async () => {
    const { getAuth } = await import('firebase-admin/auth');
    getAuth.mockReturnValue({ verifyIdToken: vi.fn().mockResolvedValue(mockDecodedToken) });
    const { isAdminSuspended } = await import('@c1rcle/core/security-state');
    isAdminSuspended.mockResolvedValue({ suspended: true, reason: 'Compromised account' });
    const handler = vi.fn();
    const res = await withAdminAuth(handler)(mockRequest('Bearer valid_token'));
    expect(res.status).toBe(404);
    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects tokens with insufficient role', async () => {
    process.env.NODE_ENV = 'production';
    const { getAuth } = await import('firebase-admin/auth');
    getAuth.mockReturnValue({ verifyIdToken: vi.fn().mockResolvedValue({ ...mockDecodedToken, admin_role: 'readonly', role: 'admin', admin: true }) });
    const handler = vi.fn();
    const res = await withAdminAuth(handler, 'ops')(mockRequest('Bearer valid_token'));
    expect(res.status).toBe(404);
    expect(handler).not.toHaveBeenCalled();
  });

  it('allows dev environment without custom claims', async () => {
    process.env.NODE_ENV = 'development';
    const { getAuth } = await import('firebase-admin/auth');
    getAuth.mockReturnValue({ verifyIdToken: vi.fn().mockResolvedValue({ ...mockDecodedToken, role: 'user', admin_role: undefined, admin: undefined }) });
    const { isAdminSuspended } = await import('@c1rcle/core/security-state');
    isAdminSuspended.mockResolvedValue({ suspended: false });
    const handler = vi.fn().mockReturnValue(NextResponse.json({ ok: true }));
    const res = await withAdminAuth(handler)(mockRequest('Bearer valid_token'));
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
