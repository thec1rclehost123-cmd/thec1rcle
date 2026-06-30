/**
 * THE C1RCLE - Admin Refund Approval API
 */

import { NextResponse } from 'next/server';
import { adminStore } from '@/lib/server/adminStore';
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
    const admin = request.user;

    const result = await adminStore.approveRefundRequest(refundId, admin);

    return NextResponse.json({
      success: true,
      approved: result.isFullyApproved,
      pendingApprovals: result.pendingApprovals,
      message: result.isFullyApproved
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
