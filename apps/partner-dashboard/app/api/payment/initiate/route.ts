/**
 * POST /api/payment/initiate
 * Thin proxy — delegates reservation-based Razorpay order creation to the
 * API Gateway. All business logic lives in the gateway at
 * POST /api/v1/payments/initiate.
 */
import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/server/withAuth';
import { fail } from '@/lib/server/apiResponse';
import { proxyToGateway, GATEWAY_URL } from '@/lib/server/apiGateway';

export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body?.reservationId) return fail('reservationId is required', 400);

  return proxyToGateway(req, `${GATEWAY_URL}/api/v1/payments/initiate`, {
    method: 'POST',
    body: JSON.stringify({ reservationId: body.reservationId }),
  });
});
