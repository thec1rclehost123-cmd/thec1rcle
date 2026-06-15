import { config } from 'dotenv';

config({ path: '.env.local' });

const apiBase =
  process.env.GUEST_API_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:4000/api/v1';

async function readJson(path) {
  const response = await fetch(`${apiBase.replace(/\/+$/, '')}${path}`);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || `Request failed (${response.status})`);
  }

  return data;
}

async function testListEvents() {
  console.log(`Fetching public events from ${apiBase}...`);
  const data = await readJson('/public/events?limit=60&sort=heat');
  const events = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
  console.log(`Final count: ${events.length}`);
  if (events[0]) {
    console.log(
      'First event:',
      events[0].id || events[0].eventId,
      events[0].title || events[0].name,
    );
  }
}

testListEvents().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
