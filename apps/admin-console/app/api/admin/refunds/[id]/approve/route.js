/**
 * THE C1RCLE - Admin Refund Approval API
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
    const token = request.headers.get('authorization').slice('Bearer '.length);
    const result = await getApiClient(token).request(`/refunds/${encodeURIComponent(refundId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'approve' }),
    });

    return NextResponse.json({
      success: true,
      approved: result.approved,
      pendingApprovals: result.pendingApprovals,
      message: result.approved
        ? 'Refund approved and processing'
        : `Approval recorded. ${result.pendingApprovals} more needed.`,
    });
  } catch (error) {
    console.error('POST /api/admin/refunds/[id]/approve error:', error);
    const status = error.message.includes('not found')
      ? 404
      : error.message.includes('already')
        ? 400
        : 500;
    return NextResponse.json({ error: 'Failed to approve refund' }, { status });
  }
}

export const POST = withAdminAuth(handler);
