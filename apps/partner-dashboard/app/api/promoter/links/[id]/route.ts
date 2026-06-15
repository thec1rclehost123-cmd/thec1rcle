import { NextRequest, NextResponse } from 'next/server';
import { requirePromoterAccess } from '@/lib/server/promoterAuthMiddleware';
import { proxyToGateway, GATEWAY_URL } from '@/lib/server/apiGateway';

/**
 * PATCH /api/promoter/links/[id]
 * Deactivate a promoter link. Verifies ownership before acting.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePromoterAccess(req);
  if ('error' in ctx)
    return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
  const { id: linkId } = await params;
  const body = await req.json().catch(() => ({}));
  return proxyToGateway(req, `${GATEWAY_URL}/api/v1/promoter/links/${linkId}`, {
    method: 'PATCH',
    body: JSON.stringify({ promoterId: ctx.promoterId, ...body }),
  });
}
