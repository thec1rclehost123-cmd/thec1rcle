import { createHmac, timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const RevalidationBody = z
  .object({
    eventId: z.string().min(1).max(180),
    mutation: z.string().min(1).max(80),
    timestamp: z.number().int(),
  })
  .strict();

function signaturesMatch(rawBody: string, supplied: string | null, secret: string) {
  if (!supplied) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const actualBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export async function POST(request: NextRequest) {
  const secret = process.env.GUEST_REVALIDATION_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: { code: 'REVALIDATION_UNAVAILABLE', message: 'Revalidation is unavailable' } },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  if (!signaturesMatch(rawBody, request.headers.get('x-c1rcle-signature'), secret)) {
    return NextResponse.json(
      { error: { code: 'SIGNATURE_INVALID', message: 'Invalid signature' } },
      { status: 401 },
    );
  }
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    body = null;
  }
  const parsed = RevalidationBody.safeParse(body);
  if (!parsed.success || Math.abs(Date.now() - parsed.data.timestamp) > 60_000) {
    return NextResponse.json(
      { error: { code: 'REVALIDATION_REQUEST_INVALID', message: 'Invalid request' } },
      { status: 400 },
    );
  }

  revalidateTag('guest-events', 'max');
  revalidateTag('guest-explore', 'max');
  revalidateTag('guest-featured', 'max');
  revalidateTag(`guest-event:${parsed.data.eventId}`, 'max');
  return NextResponse.json({
    success: true,
    eventId: parsed.data.eventId,
    mutation: parsed.data.mutation,
  });
}
