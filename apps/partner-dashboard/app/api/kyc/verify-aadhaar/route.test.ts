import { beforeEach, describe, expect, it, vi } from 'vitest';

const proxyToGatewayMock = vi.fn();

vi.mock('@/lib/server/apiGateway', () => ({
  GATEWAY_URL: 'http://gateway.test',
  proxyToGateway: proxyToGatewayMock,
}));

describe('POST /api/kyc/verify-aadhaar', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    proxyToGatewayMock.mockResolvedValue({ success: true, status: 200 });
  });

  it('forwards the bearer-authenticated request to the Gateway', async () => {
    const body = { aadhaarId: '123456789012' };
    const request = {
      json: vi.fn().mockResolvedValue(body),
      headers: new Headers({ authorization: 'Bearer test-token' }),
    } as any;

    const { POST } = await import('./route');
    await POST(request);

    expect(proxyToGatewayMock).toHaveBeenCalledWith(
      request,
      'http://gateway.test/api/v1/kyc/verify-aadhaar',
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    );
  });
});
