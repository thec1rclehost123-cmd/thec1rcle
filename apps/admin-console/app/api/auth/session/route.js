import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/server/adminMiddleware';
import { listSessions, revokeSession, revokeAllAdminSessions } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

const getHandler = async (req) => {
  const sessions = await listSessions(req.user.uid);
  return NextResponse.json({ sessions });
};

const deleteHandler = async (req) => {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const sessionId = searchParams.get('sessionId');

  if (action === 'revokeAll') {
    await revokeAllAdminSessions(req.user.uid);
    return NextResponse.json({ ok: true });
  }

  if (sessionId) {
    await revokeSession(sessionId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
};

export const GET = withAdminAuth(getHandler);
export const DELETE = withAdminAuth(deleteHandler);
