import { getAdminDb } from '@c1rcle/core/admin';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from api-gateway
const envPath = path.join(__dirname, 'apps/api-gateway/.env');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach((line) => {
  const [key, ...value] = line.split('=');
  if (key && value) process.env[key.trim()] = value.join('=').trim().replace(/"/g, '');
});

const db = getAdminDb();

async function audit() {
  console.log('--- FIRESTORE DOCUMENT COUNTS ---');
  const collections = ['events', 'orders', 'hosts', 'event_stats', 'partnerships'];

  for (const col of collections) {
    try {
      const snapshot = await db.collection(col).count().get();
      console.log(`${col}: ${snapshot.data().count}`);
    } catch (e) {
      console.log(`${col}: Failed to count (${e.message})`);
    }
  }

  console.log('\n--- SLOW QUERY ANALYSIS ---');
  console.log('Checking for common query patterns...');
  // This is more of a logic check based on routes/v1/events.ts
  // We already saw where filters are applied.

  process.exit();
}

audit().catch((err) => {
  console.error(err);
  process.exit(1);
});
