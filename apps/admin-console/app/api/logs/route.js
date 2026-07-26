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

    // Map target keys to their corresponding DocumentReferences
    const refs = uniqueTargets
      .map((targetKey) => {
        const [type, id] = targetKey.split(':');
        if (!id || id === 'undefined' || id === 'null') return null;

        let collectionName = null;
        if (type === 'venue') collectionName = 'venues';
        else if (type === 'host') collectionName = 'hosts';
        else if (type === 'promoter') collectionName = 'promoters';
        else if (type === 'event') collectionName = 'events';
        else if (type === 'user') collectionName = 'users';
        else if (type === 'onboarding_request') collectionName = 'onboarding_requests';

        if (collectionName) {
          return {
            ref: db.collection(collectionName).doc(id),
            key: targetKey,
            type,
          };
        }
        return null;
      })
      .filter(Boolean);

    // Chunk refs to batches of 100 to avoid payload size/limit issues
    const chunks = [];
    for (let i = 0; i < refs.length; i += 100) {
      chunks.push(refs.slice(i, i + 100));
    }

    await Promise.all(
      chunks.map(async (chunkRefs) => {
        try {
          const docRefs = chunkRefs.map((r) => r.ref);
          const snapshots = await db.getAll(...docRefs);
          snapshots.forEach((doc, idx) => {
            try {
              const { key, type } = chunkRefs[idx];
              if (doc.exists) {
                let name = null;
                const data = doc.data();
                if (type === 'venue') {
                  name = data.name || data.venueName;
                } else if (type === 'host') {
                  name = data.name;
                } else if (type === 'promoter') {
                  name = data.name;
                } else if (type === 'event') {
                  name = data.title || data.name;
                } else if (type === 'user') {
                  name = data.displayName || data.name || data.email;
                } else if (type === 'onboarding_request') {
                  name = data.data?.name || data.name;
                }
                if (name) {
                  targetMap.set(key, name);
                }
              }
            } catch (_) {
              // ignore individual parsing failures
            }
          });
        } catch (_) {
          // ignore batch lookup failures
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
