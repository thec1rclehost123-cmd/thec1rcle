/**
 * THE C1RCLE - Admin Refund Rejection API
 */

import { NextResponse } from 'next/server';
import { getApiClient } from '@/lib/server/apiClient';
import { withAdminAuth } from '@/lib/server/adminMiddleware';
import { rateLimit } from '@/lib/server/rateLimit';

export const dynamic = 'force-dynamic';

async function handler(request, { params }) {
  try {
    if (!(await rateLimit(request, 5))) {
      return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
    }

    const { id } = await params;
    const refundId = id;
    const body = await request.json();
    const { reason } = body;

    if (!reason) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
    }

    const token = request.headers.get('authorization').slice('Bearer '.length);
    await getApiClient(token).request(`/refunds/${encodeURIComponent(refundId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'reject', reason }),
    });

    return NextResponse.json({ success: true, message: 'Refund request rejected' });
  } catch (error) {
    console.error('POST /api/admin/refunds/[id]/reject error:', error);
    const status = error.message.includes('not found')
      ? 404
      : error.message.includes('already')
        ? 400
        : 500;
    return NextResponse.json({ error: 'Failed to reject refund' }, { status });
  }
}

export const POST = withAdminAuth(handler);
