import { NextResponse } from 'next/server';
import { adminStore } from '@/lib/server/adminStore';
import { withAdminAuth } from '@/lib/server/adminMiddleware';

export const dynamic = 'force-dynamic';

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');

    if (!q || q.length < 3) {
      return NextResponse.json({ error: 'Search query too short' }, { status: 400 });
    }

    // Try direct doc fetch by ID for each entity type (O(1) per collection),
    // plus a direct email index query for users (avoids full collection scan).
    const [userById, userByEmail, venueById, hostById, promoterById, eventById, orderById] =
      await Promise.all([
        adminStore.getDocumentById('users', q),
        adminStore.findUserByEmail(q),
        adminStore.getDocumentById('venues', q),
        adminStore.getDocumentById('hosts', q),
        adminStore.getDocumentById('promoters', q),
        adminStore.getDocumentById('events', q),
        adminStore.getDocumentById('orders', q),
      ]);

    const results = [
      ...(userById ? [{ type: 'user', ...userById }] : []),
      ...(userByEmail ? [{ type: 'user', ...userByEmail }] : []),
      ...(venueById ? [{ type: 'venue', ...venueById }] : []),
      ...(hostById ? [{ type: 'host', ...hostById }] : []),
      ...(promoterById ? [{ type: 'promoter', ...promoterById }] : []),
      ...(eventById ? [{ type: 'event', ...eventById }] : []),
      ...(orderById ? [{ type: 'order', ...orderById }] : []),
    ];

    const uniqueResults = Array.from(new Map(results.map((item) => [item.id, item])).values());
    return NextResponse.json({ results: uniqueResults });
  } catch (error) {
    console.error('Lookup Error:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAdminAuth(handler);
