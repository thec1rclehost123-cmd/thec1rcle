import { config } from 'dotenv';

config({ path: '.env.local' });

const apiBase =
  process.env.GUEST_API_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:4000/api/v1';

const [, , orderId = 'order-1', eventId = 'after-dark-az', quantity = '1'] = process.argv;
const sessionCookie = process.env.GUEST_SESSION_COOKIE;
const csrfToken = process.env.GUEST_CSRF_TOKEN;

async function testShare() {
  if (!sessionCookie || !csrfToken) {
    throw new Error(
      'Set GUEST_SESSION_COOKIE and GUEST_CSRF_TOKEN before testing authenticated ticket sharing.',
    );
  }

  const response = await fetch(`${apiBase.replace(/\/+$/, '')}/tickets/share`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: sessionCookie,
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify({
      orderId,
      eventId,
      quantity: Number(quantity),
    }),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || `Request failed (${response.status})`);
  }

  console.log('Share bundle created:', data);
}

testShare().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
