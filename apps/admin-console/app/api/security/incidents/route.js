/**
 * GET  /api/security/incidents  — list incidents (paginated, filterable)
 * POST /api/security/incidents  — create an incident (flag a user / IP / admin)
 */

import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/server/adminMiddleware';
import { rateLimit } from '@/lib/server/rateLimit';
import { queryIncidents, createIncident } from '@c1rcle/core/security-logger';

export const dynamic = 'force-dynamic';

async function handleGet(req) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || undefined;
  const severity = searchParams.get('severity') || undefined;
  const entityType = searchParams.get('entityType') || undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

  const incidents = await queryIncidents({ status, severity, entityType, limit });
  return NextResponse.json({ ok: true, incidents, count: incidents.length });
}

async function handlePost(req) {
  if (!(await rateLimit(req, 10))) {
    return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
  }

  const body = await req.json();
  const { entityType, entityId, severity, reason, evidence, linkedEventId } = body;

  if (!entityType || !entityId || !reason) {
    return NextResponse.json(
      { error: 'entityType, entityId, and reason are required' },
      { status: 400 },
    );
  }

  const VALID_ENTITY_TYPES = ['user', 'ip', 'admin'];
  if (!VALID_ENTITY_TYPES.includes(entityType)) {
    return NextResponse.json({ error: 'Invalid entityType' }, { status: 400 });
  }

  const incidentId = await createIncident({
    entityType,
    entityId,
    severity: severity || 'medium',
    reason,
    evidence: evidence || {},
    linkedEventId: linkedEventId || null,
    createdBy: req.user.uid,
  });

  return NextResponse.json({ ok: true, incidentId }, { status: 201 });
}

export const GET = withAdminAuth(handleGet);
export const POST = withAdminAuth(handlePost);
