/**
 * THE C1RCLE - Admin Refunds API
 * List and filter refund requests
 */

import { NextResponse } from 'next/server';
import { adminStore } from '@/lib/server/adminStore';
import { withAdminAuth } from '@/lib/server/adminMiddleware';

export const dynamic = 'force-dynamic';

const ALLOWED_REFUND_STATUSES = ['pending', 'approved', 'rejected', 'processing', 'all'];

async function handler(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const rawLimit = parseInt(searchParams.get('limit') || '50', 10);

    if (!ALLOWED_REFUND_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
    }
    if (isNaN(rawLimit) || rawLimit <= 0) {
      return NextResponse.json({ error: 'Invalid limit' }, { status: 400 });
    }
    const limit = Math.min(rawLimit, 50);
    const cursor = searchParams.get('cursor') || null;

    const result = await adminStore.getRefunds({ status, limit, cursor });

    return NextResponse.json({
      refunds: result.refunds,
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
      total: result.refunds.length,
    });
  } catch (error) {
    console.error('GET /api/admin/refunds error:', error);
    return NextResponse.json({ error: 'Failed to fetch refunds' }, { status: 500 });
  }
}

export const GET = withAdminAuth(handler);
