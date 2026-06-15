import { NextRequest } from 'next/server';
import { proxyToGateway, GATEWAY_URL } from '@/lib/server/apiGateway';

export async function GET(req: NextRequest) {
  const { search } = new URL(req.url);
  return proxyToGateway(req, `${GATEWAY_URL}/api/v1/profile${search}`, {});
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return proxyToGateway(req, `${GATEWAY_URL}/api/v1/profile`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
