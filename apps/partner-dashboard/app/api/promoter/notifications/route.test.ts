import { beforeEach, describe, expect, it, vi } from 'vitest';

const requirePromoterAccessMock = vi.fn();
const proxyToGatewayMock = vi.fn();

vi.mock('@/lib/server/promoterAuthMiddleware', () => ({
  requirePromoterAccess: requirePromoterAccessMock,
}));

vi.mock('@/lib/server/apiGateway', () => ({
  GATEWAY_URL: 'http://gateway.test',
  proxyToGateway: proxyToGatewayMock,
}));

vi.mock('@/lib/server/apiResponse', () => ({
  ok: (data: any, message = '', status = 200) =>
    Response.json({ success: true, ...data, message }, { status }),
  fail: (message: string, status = 500) =>
    Response.json({ success: false, error: message }, { status }),
}));

describe('/api/promoter/notifications', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requirePromoterAccessMock.mockResolvedValue({
      uid: 'user_1',
      promoterId: 'promoter_1',
      role: 'PROMOTER',
      displayName: 'Promoter One',
    });
    proxyToGatewayMock.mockResolvedValue(Response.json({ success: true }, { status: 200 }));
  });

  it('proxies GET requests to the promoter notifications gateway route', async () => {
    const { GET } = await import('./route');
    const req = new Request('http://localhost/api/promoter/notifications?limit=10') as any;
    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(proxyToGatewayMock).toHaveBeenCalledWith(
      req,
      'http://gateway.test/api/v1/partners/promoters/notifications?limit=10&promoterId=promoter_1',
      {},
    );
  });

  it('proxies PATCH requests with the resolved promoterId in the body', async () => {
    const { PATCH } = await import('./route');
    const req = {
      json: vi.fn().mockResolvedValue({ markAll: true }),
      headers: {
        get: () => null,
      },
    } as any;
    const response = await PATCH(req);

    expect(response.status).toBe(200);
    expect(proxyToGatewayMock).toHaveBeenCalledWith(
      req,
      'http://gateway.test/api/v1/partners/promoters/notifications',
      {
        method: 'PATCH',
        body: JSON.stringify({
          promoterId: 'promoter_1',
          markAll: true,
        }),
      },
    );
  });
});
