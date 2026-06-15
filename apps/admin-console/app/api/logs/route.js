import { NextResponse } from 'next/server';
import { adminStore } from '@/lib/server/adminStore';
import { withAdminAuth } from '@/lib/server/adminMiddleware';

export const dynamic = 'force-dynamic';

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
    const cursor = searchParams.get('cursor') || null;

    const raw = await adminStore.listCollection('admin_audit_logs', { limit, cursor });

    const logs = raw.map((entry) => ({
      id: entry.id,
      actorEmail: entry.adminEmail || entry.adminId || 'system',
      actionType: entry.action,
      targetId: entry.targetId,
      targetType: entry.targetType,
      reason: entry.reason,
      status: entry.status || 'success',
      ipAddress: entry.context?.ipAddress || null,
      proposalId: entry.proposalId || null,
      createdAt: entry.timestamp || entry.createdAt || new Date().toISOString(),
    }));

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('[Logs API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAdminAuth(handler);
