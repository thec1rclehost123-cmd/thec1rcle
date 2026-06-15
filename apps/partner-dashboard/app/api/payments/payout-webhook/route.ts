import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { proxyToGateway, GATEWAY_URL } from '@/lib/server/apiGateway';

function errorResponse(req: NextRequest, status: number, message: string, code?: string) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code:
          code ||
          (status === 401 ? 'UNAUTHORIZED' : status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST'),
        message,
        requestId: req.headers.get('x-request-id') || crypto.randomUUID(),
      },
    },
    { status },
  );
}

function verifyHmac(rawBody: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.PAYOUT_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[payments/payout-webhook] PAYOUT_WEBHOOK_SECRET is not configured');
    return errorResponse(req, 500, 'Webhook not configured');
  }

  const body = await req.text();
  const signature = req.headers.get('x-razorpay-signature') ?? '';

  if (!verifyHmac(body, signature, secret)) {
    return errorResponse(req, 401, 'Invalid signature');
  }

  return proxyToGateway(req, `${GATEWAY_URL}/api/v1/payments/payout-webhook`, {
    method: 'POST',
    body,
  });
}
