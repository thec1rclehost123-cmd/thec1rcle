import { beforeEach, describe, expect, it, vi } from 'vitest';

const proxyToGatewayMock = vi.fn();

vi.mock('@/lib/server/apiGateway', () => ({
  GATEWAY_URL: 'http://gateway.test',
  proxyToGateway: proxyToGatewayMock,
}));

describe('GET /api/finance/payout-config', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    proxyToGatewayMock.mockResolvedValue({ success: true, status: 200 });
  });

  it('forwards the bearer-authenticated request to the Gateway', async () => {
    const request = {
      headers: new Headers({ authorization: 'Bearer test-token' }),
    } as any;

    const { GET } = await import('./route');
    await GET(request);

    expect(proxyToGatewayMock).toHaveBeenCalledWith(
      request,
      'http://gateway.test/api/v1/finance/payout-config',
      {},
    );
  });
});
