import { NextRequest } from 'next/server';
import { proxyToGateway, GATEWAY_URL } from '@/lib/server/apiGateway';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { search } = new URL(req.url);
  return proxyToGateway(
    req,
    `${GATEWAY_URL}/api/v1/scan/guestlist?eventId=${encodeURIComponent(id)}`,
    {},
  );
}
