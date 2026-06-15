import { proxyToGateway, GATEWAY_URL } from '@/lib/server/apiGateway';
import { withAuth } from '@/lib/server/withAuth';

export const POST = withAuth(async (req) => {
  const body = await req.json().catch(() => ({}));
  return proxyToGateway(req, `${GATEWAY_URL}/api/v1/setup/provision-venue`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
});
