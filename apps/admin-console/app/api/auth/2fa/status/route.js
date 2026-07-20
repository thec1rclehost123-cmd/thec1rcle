import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/server/adminMiddleware';
import { getTwoFactorStatus } from '@/lib/server/twoFactor';

export const dynamic = 'force-dynamic';

const handler = async (req) => {
  const status = await getTwoFactorStatus(req.user.uid);
  return NextResponse.json(status);
};

export const GET = withAdminAuth(handler);
