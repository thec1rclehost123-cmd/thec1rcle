import { NextRequest, NextResponse } from 'next/server';
import { requirePromoterAccess } from '@/lib/server/promoterAuthMiddleware';
import { GATEWAY_URL } from '@/lib/server/apiGateway';

export async function POST(req: NextRequest) {
  const ctx = await requirePromoterAccess(req);
  if ('error' in ctx)
    return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });

  if (!GATEWAY_URL) {
    return NextResponse.json(
      { success: false, error: { message: 'Gateway not configured' } },
      { status: 503 },
    );
  }

  const formData = await req.formData();
  formData.set('promoterId', ctx.promoterId);

  const target = `${GATEWAY_URL}/api/v1/partners/promoters/upload`;

  try {
    const headers: Record<string, string> = {};
    const auth = req.headers.get('authorization');
    if (auth) headers.Authorization = auth;

    const res = await fetch(target, { method: 'POST', body: formData as any, headers });
    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { text };
    }

    console.debug('[promoter upload proxy] gateway response', { status: res.status, parsed });

    return NextResponse.json(parsed, { status: res.status });
  } catch (err: any) {
    console.error('[promoter upload proxy] forward failed', err?.message || err);
    return NextResponse.json(
      { success: false, error: { message: err?.message || 'Forward failed' } },
      { status: 502 },
    );
  }
}
