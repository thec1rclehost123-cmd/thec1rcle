import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/server/adminMiddleware';
import { setupTwoFactor } from '@/lib/server/twoFactor';

export const dynamic = 'force-dynamic';

const handler = async (req) => {
  const result = await setupTwoFactor(req.user.uid, req.user.email || 'admin@thec1rcle.com');
  return NextResponse.json(result);
};

export const POST = withAdminAuth(handler);
