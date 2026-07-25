import { createHmac } from 'node:crypto';

export async function revalidateGuestEvent(eventId: string, mutation: string) {
  const baseUrl = process.env.GUEST_PORTAL_URL;
  const secret = process.env.GUEST_REVALIDATION_SECRET;
  if (!baseUrl || !secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Guest Portal revalidation is not configured');
    }
    return { skipped: true };
  }

  const payload = JSON.stringify({ eventId, mutation, timestamp: Date.now() });
  const signature = createHmac('sha256', secret).update(payload).digest('hex');
  const response = await fetch(
    `${baseUrl.replace(/\/+$/, '')}/api/internal/revalidate`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-c1rcle-signature': signature,
      },
      body: payload,
      signal: AbortSignal.timeout(5_000),
    },
  );
  if (!response.ok) {
    throw new Error(`Guest Portal revalidation failed with ${response.status}`);
  }
  return { skipped: false };
}
