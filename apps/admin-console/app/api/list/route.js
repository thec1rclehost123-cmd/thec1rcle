import { NextResponse } from 'next/server';
import { adminStore } from '@/lib/server/adminStore';
import { withAdminAuth } from '@/lib/server/adminMiddleware';

export const dynamic = 'force-dynamic';

const ALLOWED_COLLECTIONS = [
  'users',
  'venues',
  'hosts',
  'promoters',
  'admins',
  'events',
  'orders',
  'onboarding_requests',
  'host_applications',
  'admin_audit_logs',
  'proposed_actions',
  'support_tickets',
  'platform_config',
  'platform_settings',
  'app_config',
  'safety_reports',
  'failed_webhooks',
  'retry_jobs',
  'promotions',
  'media_reports',
  'tickets',
  'platform_announcements',
];

const ALLOWED_SORT_FIELDS = ['createdAt', 'updatedAt', 'status', 'amount', 'name', 'email'];

import { getAdminStorage } from '@/lib/firebase/admin';

function parseStorageUrl(url) {
  if (!url || typeof url !== 'string') return null;

  if (url.startsWith('gs://')) {
    const parts = url.substring(5).split('/');
    const bucketName = parts[0];
    const objectPath = parts.slice(1).join('/');
    return { bucketName, objectPath };
  }

  if (url.startsWith('https://storage.googleapis.com/')) {
    const parts = url.substring(31).split('/');
    const bucketName = parts[0];
    const objectPath = parts.slice(1).join('/').split('?')[0];
    return { bucketName, objectPath };
  }

  if (url.startsWith('https://firebasestorage.googleapis.com/')) {
    const match = url.match(
      /https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^/]+)\/o\/([^?#]+)/,
    );
    if (match) {
      const bucketName = match[1];
      const objectPath = decodeURIComponent(match[2]);
      return { bucketName, objectPath };
    }
  }

  return null;
}

async function signStorageUrl(url) {
  if (!url || typeof url !== 'string') return url;
  const parsed = parseStorageUrl(url);
  if (!parsed) return url;

  try {
    const storage = getAdminStorage();
    const bucket = storage.bucket();

    if (
      parsed.bucketName === bucket.name &&
      (parsed.objectPath.startsWith('venues/') ||
        parsed.objectPath.startsWith('support-attachments/'))
    ) {
      const file = bucket.file(parsed.objectPath);
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });
      return signedUrl;
    }
  } catch (err) {
    console.error('Failed to sign admin storage URL:', err);
  }
  return url;
}

async function handler(req) {
  const { searchParams } = new URL(req.url);
  const collection = searchParams.get('collection');
  const status = searchParams.get('status');
  const sortBy = searchParams.get('sortBy') || 'createdAt';
  const cursor = searchParams.get('cursor') || null;
  const rawLimit = parseInt(searchParams.get('limit') || '50', 10);

  if (isNaN(rawLimit) || rawLimit <= 0) {
    return NextResponse.json({ error: 'Invalid limit' }, { status: 400 });
  }
  const limit = Math.min(rawLimit, 200);

  if (!ALLOWED_SORT_FIELDS.includes(sortBy)) {
    return NextResponse.json({ error: 'Invalid sort field' }, { status: 400 });
  }

  const baseCollection = collection ? collection.split('/')[0] : null;

  if (!collection || !ALLOWED_COLLECTIONS.includes(baseCollection)) {
    return NextResponse.json({ error: 'Invalid resource request' }, { status: 400 });
  }

  // --- 🔐 RBAC ENFORCEMENT ---
  const adminRole = req.user.admin_role;
  const ALLOWED_MAP = {
    super: ['*'],
    admin: ['*'],
    finance: [
      'users',
      'orders',
      'payments',
      'onboarding_requests',
      'host_applications',
      'admin_audit_logs',
      'retry_jobs',
    ],
    ops: [
      'users',
      'venues',
      'hosts',
      'promoters',
      'events',
      'proposed_actions',
      'admin_audit_logs',
      'safety_reports',
      'retry_jobs',
      'failed_webhooks',
      'onboarding_requests',
      'host_applications',
      'support_tickets',
      'platform_settings',
      'app_config',
      'promotions',
      'tickets',
      'platform_announcements',
    ],
    support: [
      'users',
      'venues',
      'hosts',
      'promoters',
      'events',
      'safety_reports',
      'support_tickets',
      'onboarding_requests',
      'platform_announcements',
    ],
    content: ['venues', 'events', 'media_reports'],
    readonly: ['users', 'venues', 'hosts', 'promoters', 'events'],
  };

  const allowed = ALLOWED_MAP[adminRole] || [];
  if (!allowed.includes('*') && !allowed.includes(baseCollection)) {
    return NextResponse.json(
      { error: 'Access Denied: Insufficient authority for this dataset.' },
      { status: 403 },
    );
  }

  try {
    let results = await adminStore.listCollection(collection, {
      status,
      limit,
      adminRole,
      sortBy: sortBy !== 'createdAt' ? sortBy : undefined,
      cursor,
    });

    // Specialized Mapping for Events
    if (collection === 'events') {
      const { mapEventForClient } = await import('@c1rcle/core/events');
      results = results.map((r) => mapEventForClient(r, r.id));
    }

    if (collection === 'venues') {
      results = await Promise.all(
        results.map(async (r) => {
          const fieldsToSign = [
            'profileImage',
            'photoURL',
            'logo',
            'coverImage',
            'coverURL',
            'backdropURL',
          ];
          for (const f of fieldsToSign) {
            if (r[f]) r[f] = await signStorageUrl(r[f]);
          }
          if (Array.isArray(r.photos)) {
            r.photos = await Promise.all(r.photos.map((p) => signStorageUrl(p)));
          }
          return r;
        }),
      );
    }

    if (collection === 'support_tickets') {
      results = await Promise.all(
        results.map(async (r) => {
          const arraysToSign = ['images', 'documents', 'screenshots', 'screenRecordings'];
          for (const arr of arraysToSign) {
            if (Array.isArray(r[arr])) {
              r[arr] = await Promise.all(r[arr].map((item) => signStorageUrl(item)));
            }
          }
          return r;
        }),
      );
    }

    return NextResponse.json({ data: results, results });
  } catch (error) {
    console.error(`[SECURITY] List API Error [${collection}]:`, error.message);
    return NextResponse.json({ error: 'Generic data error' }, { status: error.statusCode || 500 });
  }
}

export const GET = withAdminAuth(handler);
