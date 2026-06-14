import { config } from "dotenv";

config({ path: ".env.local" });

const apiBase =
  process.env.GUEST_API_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:4000/api/v1";

async function testApi() {
  console.log(`Fetching events from ${apiBase}...`);
  const response = await fetch(`${apiBase.replace(/\/+$/, "")}/public/events?limit=60&sort=heat`);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    console.error("API Error:", response.status, data || text);
    process.exitCode = 1;
    return;
  }

  const events = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
  console.log(`Found ${events.length} events.`);
  if (events.length > 0) {
    console.log("Sample event city:", events[0].city);
    console.log("Sample event status:", events[0].status || events[0].statusKey);
  }
}

testApi().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
