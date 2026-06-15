/**
 * POST /api/security/unblock
 *
 * Admin override to manually lift a block/suspension.
 * Body: { type: "ip"|"user"|"admin"|"flag", target: string }
 *
 *   type="ip"    → unblockIp(target)
 *   type="user"  → unblockUser(target)
 *   type="flag"  → unflagUser(target)
 *   type="admin" → clearAdminSuspension(target)
 *
 * Protected: requires 'ops' role or above.
 * Every override is logged with the acting adminId for the audit trail.
 */

import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/server/adminMiddleware';
import {
  unblockIp,
  unblockUser,
  unflagUser,
  clearAdminSuspension,
} from '@c1rcle/core/security-state';
import { logAdminAction } from '@/lib/server/logger';

export const dynamic = 'force-dynamic';

const VALID_TYPES = new Set(['ip', 'user', 'flag', 'admin']);

async function handler(req) {
  const body = await req.json().catch(() => null);

  if (!body || !body.type || !body.target) {
    return NextResponse.json({ error: 'type and target are required' }, { status: 400 });
  }

  const { type, target } = body;

  if (!VALID_TYPES.has(type)) {
    return NextResponse.json(
      { error: 'Invalid type. Must be ip|user|flag|admin' },
      { status: 400 },
    );
  }

  const adminId = req.user.uid;
  const requestId = req.user.requestId;

  switch (type) {
    case 'ip':
      await unblockIp(target);
      break;
    case 'user':
      await unblockUser(target);
      break;
    case 'flag':
      await unflagUser(target);
      break;
    case 'admin':
      await clearAdminSuspension(target);
      break;
  }

  logAdminAction('SECURITY_OVERRIDE', {
    adminId,
    requestId,
    overrideType: type,
    target,
  });

  return NextResponse.json({ ok: true, type, target });
}

// Requires 'ops' role — security overrides are not available to readonly/support roles
export const POST = withAdminAuth(handler, 'ops');
