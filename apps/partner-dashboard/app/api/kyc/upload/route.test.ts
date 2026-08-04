import { beforeEach, describe, expect, it, vi } from 'vitest';

const proxyToGatewayMock = vi.fn();

vi.mock('@/lib/server/apiGateway', () => ({
  GATEWAY_URL: 'http://gateway.test',
  proxyToGateway: proxyToGatewayMock,
}));

describe('POST /api/kyc/upload', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    proxyToGatewayMock.mockResolvedValue({ success: true, status: 200 });
  });

  it('forwards multipart data and leaves authentication enforcement to the Gateway', async () => {
    const formData = new FormData();
    formData.append('stepId', 'kyc_identity');
    formData.append('fieldName', 'doc_front');
    const request = {
      formData: vi.fn().mockResolvedValue(formData),
      headers: new Headers({ authorization: 'Bearer test-token' }),
    } as any;

    const { POST } = await import('./route');
    await POST(request);

    expect(proxyToGatewayMock).toHaveBeenCalledWith(
      request,
      'http://gateway.test/api/v1/kyc/upload',
      {
        method: 'POST',
        body: formData,
      },
    );
  });
});
