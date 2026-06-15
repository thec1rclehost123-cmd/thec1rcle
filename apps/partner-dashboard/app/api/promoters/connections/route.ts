import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { verifyAuth } from '@/lib/server/auth';
import { getAdminApp, isFirebaseConfigured } from '@/lib/firebase/admin';

export async function GET(req: NextRequest) {
  if (!isFirebaseConfigured()) {
    return NextResponse.json({ error: 'Firebase not configured' }, { status: 503 });
  }

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
    const db = getFirestore(getAdminApp());

    let q: any = db.collection('promoter_connections');
    if (entityType === 'promoter') {
      q = q.where('promoterId', '==', entityId);
    } else {
      q = q.where('targetId', '==', entityId);
    }
    if (status) q = q.where('status', '==', status);

    const snap = await q.get();
    const connections = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

    const promoterIds = [...new Set(connections.map((c: any) => c.promoterId).filter(Boolean))];
    const promoterProfiles = new Map<string, any>();
    if (promoterIds.length > 0) {
      for (let i = 0; i < promoterIds.length; i += 30) {
        const batch = promoterIds.slice(i, i + 30);
        const profileSnap = await db.collection('promoters').where('__name__', 'in', batch).get();
        profileSnap.docs.forEach((d: any) => promoterProfiles.set(d.id, d.data()));
      }
    }

    const result = connections.map((c: any) => {
      const profile = promoterProfiles.get(c.promoterId);
      return {
        id: c.id,
        promoterId: c.promoterId,
        promoterName: profile?.displayName || profile?.name || c.promoterName || 'Unknown Promoter',
        promoterEmail: profile?.email || c.promoterEmail || '',
        promoterPhone: profile?.phone || c.promoterPhone || '',
        promoterInstagram: profile?.instagram || c.promoterInstagram || '',
        status: c.status,
        createdAt: c.createdAt || null,
      };
    });

    return NextResponse.json({ connections: result });
  } catch (err: any) {
    console.error('[promoters/connections] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
