import { NextRequest, NextResponse } from 'next/server';
import { proxyToGateway, GATEWAY_URL } from '@/lib/server/apiGateway';

export async function GET(req: NextRequest) {
  return proxyToGateway(req, `${GATEWAY_URL}/api/v1/auth/me`, {});
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return proxyToGateway(req, `${GATEWAY_URL}/api/v1/auth/me`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
