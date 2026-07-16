import { NextResponse } from 'next/server';
import { adminStore } from '@/lib/server/adminStore';
import { withAdminAuth } from '@/lib/server/adminMiddleware';

import { getAdminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
    const cursor = searchParams.get('cursor') || null;

    const raw = await adminStore.listCollection('admin_audit_logs', { limit, cursor });

    const db = getAdminDb();
    const targetMap = new Map();
    const uniqueTargets = Array.from(
      new Set(
        raw
          .map((r) => `${r.targetType || 'system'}:${r.targetId || r.targetUid}`)
          .filter(
            (t) => !t.endsWith(':unknown') && !t.endsWith(':null') && !t.endsWith(':undefined'),
          ),
      ),
    );

    await Promise.all(
      uniqueTargets.map(async (targetKey) => {
        const [type, id] = targetKey.split(':');
        if (!id || id === 'undefined' || id === 'null') return;

        let name = null;
        try {
          if (type === 'venue') {
            const doc = await db.collection('venues').doc(id).get();
            if (doc.exists) name = doc.data().name || doc.data().venueName;
          } else if (type === 'host') {
            const doc = await db.collection('hosts').doc(id).get();
            if (doc.exists) name = doc.data().name;
          } else if (type === 'promoter') {
            const doc = await db.collection('promoters').doc(id).get();
            if (doc.exists) name = doc.data().name;
          } else if (type === 'event') {
            const doc = await db.collection('events').doc(id).get();
            if (doc.exists) name = doc.data().title || doc.data().name;
          } else if (type === 'user') {
            const doc = await db.collection('users').doc(id).get();
            if (doc.exists) name = doc.data().displayName || doc.data().name || doc.data().email;
          } else if (type === 'onboarding_request') {
            const doc = await db.collection('onboarding_requests').doc(id).get();
            if (doc.exists) {
              const data = doc.data();
              name = data.data?.name || data.name;
            }
          }
        } catch (_) {
          // ignore name lookup failures
        }
        if (name) {
          targetMap.set(targetKey, name);
        }
      }),
    );

    const logs = raw.map((entry) => {
      const targetKey = `${entry.targetType || 'system'}:${entry.targetId || entry.targetUid}`;
      return {
        id: entry.id,
        actorEmail:
          entry.actorEmail || entry.adminEmail || entry.adminId || entry.actorId || 'system',
        actorName: entry.actorName || entry.adminName || entry.displayName || null,
        adminRole: entry.adminRole || entry.admin_role || 'admin',
        adminId: entry.adminId || entry.admin_uid || null,
        actionType: entry.action || entry.actionType,
        targetId: entry.targetId || entry.targetUid || 'unknown',
        targetType: entry.targetType || 'system',
        targetName: targetMap.get(targetKey) || null,
        reason:
          entry.reason || entry.note || entry.resubmitReason || 'Routine administrative task.',
        status: entry.status || 'success',
        ipAddress: entry.context?.ipAddress || entry.ip || null,
        proposalId: entry.proposalId || null,
        createdAt: entry.timestamp || entry.createdAt || new Date().toISOString(),
        before: entry.before || null,
        after: entry.after || null,
        metadata: entry.metadata || entry.details || null,
      };
    });

    // Ensure they are chronologically ordered (latest first)
    logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('[Logs API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAdminAuth(handler);
