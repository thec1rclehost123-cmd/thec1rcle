import { NextResponse } from 'next/server';
import { adminStore } from '@/lib/server/adminStore';
import { withAdminAuth } from '@/lib/server/adminMiddleware';

export const dynamic = 'force-dynamic';

const SEARCHABLE_COLLECTIONS = [
  'users',
  'venues',
  'hosts',
  'promoters',
  'events',
  'orders',
  'onboarding_requests',
  'host_applications',
];

const RBAC_SEARCH_MAP = {
  super: ['*'],
  admin: ['*'],
  finance: ['users', 'orders', 'onboarding_requests', 'host_applications'],
  ops: ['users', 'venues', 'hosts', 'promoters', 'events', 'onboarding_requests', 'host_applications'],
  support: ['users', 'venues', 'hosts', 'promoters', 'events', 'onboarding_requests'],
  content: ['venues', 'events'],
  readonly: ['users', 'venues', 'hosts', 'promoters', 'events'],
};

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');
    const collection = searchParams.get('collection');
    const rawLimit = parseInt(searchParams.get('limit') || '25', 10);

    if (!q || q.length < 2) {
      return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 });
    }

    const limit = Math.min(rawLimit, 100);
    const adminRole = req.user.admin_role;

    const allowed = RBAC_SEARCH_MAP[adminRole] || [];
    const canAccessAll = allowed.includes('*');

    const collectionsToSearch = collection
      ? [collection]
      : SEARCHABLE_COLLECTIONS;

    const results = [];

    for (const col of collectionsToSearch) {
      if (results.length >= limit) break;
      if (!canAccessAll && !allowed.includes(col)) continue;

      const { items } = await adminStore.searchCollection(col, q, {
        limit: limit - results.length,
        adminRole,
      });

      for (const item of items) {
        if (results.length >= limit) break;
        results.push({ ...item, _collection: col });
      }
    }

    return NextResponse.json({ results, total: results.length });
  } catch (error) {
    console.error('[Search API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withAdminAuth(handler);
