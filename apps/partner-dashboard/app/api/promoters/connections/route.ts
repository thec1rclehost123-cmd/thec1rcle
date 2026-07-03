import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/server/auth';
import { GATEWAY_URL } from '@/lib/server/apiGateway';

export async function GET(req: NextRequest) {
  const decoded = await verifyAuth(req);
  if (!decoded) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const entityId = searchParams.get('entityId');
  const entityType = searchParams.get('entityType') || 'venue';
  const status = searchParams.get('status') || 'approved';

  if (!entityId) {
    return NextResponse.json({ error: 'entityId required' }, { status: 400 });
  }

  try {
    const token = req.headers.get('authorization') || '';

    // Construct the gateway URL based on entityType
    let gatewayPath = '';
    const headers: Record<string, string> = {
      Authorization: token,
      'Content-Type': 'application/json',
    };

    if (entityType === 'venue') {
      gatewayPath = `/api/v1/partners/venues/promoters/connections?status=${status}`;
      headers['x-venue-id'] = entityId;
    } else if (entityType === 'host') {
      gatewayPath = `/api/v1/partners/hosts/promoters/connections?status=${status}`;
      headers['x-host-id'] = entityId;
    } else {
      gatewayPath = `/api/v1/partners/promoters/connections?status=${status}`;
      headers['x-partner-id'] = entityId;
    }

    const gatewayRes = await fetch(`${GATEWAY_URL}${gatewayPath}`, { headers });
    const payload = await gatewayRes.json();

    if (!gatewayRes.ok) {
      return NextResponse.json(
        { error: payload.error?.message || 'Gateway error' },
        { status: gatewayRes.status },
      );
    }

    return NextResponse.json(payload);
  } catch (err: any) {
    console.error('[promoters/connections] Proxy Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
