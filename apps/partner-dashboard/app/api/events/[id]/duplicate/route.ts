import { NextRequest } from 'next/server';
import { proxyToGateway, GATEWAY_URL } from '@/lib/server/apiGateway';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { search } = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  return proxyToGateway(req, `${GATEWAY_URL}/api/v1/events/${id}/duplicate${search}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
