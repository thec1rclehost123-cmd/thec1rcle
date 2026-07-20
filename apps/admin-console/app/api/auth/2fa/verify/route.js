import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/server/adminMiddleware';
import { validateBody } from '@/lib/server/validators';
import { verifyTwoFactor, enableTwoFactor, getTwoFactorStatus } from '@/lib/server/twoFactor';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const verifySchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

const handler = async (req) => {
  const { data, error } = await validateBody(req, verifySchema);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const status = await getTwoFactorStatus(req.user.uid);

  const result = await verifyTwoFactor(req.user.uid, data.token);
  if (!result.valid) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  if (!status.enabled) {
    await enableTwoFactor(req.user.uid);
  }

  return NextResponse.json({ ok: true, recovery: result.recovery || null });
};

export const POST = withAdminAuth(handler);
