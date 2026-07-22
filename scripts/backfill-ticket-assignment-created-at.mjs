import { config } from 'dotenv';

const apply = process.argv.includes('--apply');
const envPath = process.argv.find((argument) => argument.startsWith('--env='))?.slice(6);
config({ path: envPath || './apps/api-gateway/.env.development' });

const { getAdminDb } = await import('../packages/core/admin.js');
const db = getAdminDb();
const snapshot = await db.collection('ticket_assignments').get();
const missing = snapshot.docs.filter((doc) => !doc.data().createdAt);

if (apply && missing.length) {
  for (let index = 0; index < missing.length; index += 400) {
    const batch = db.batch();
    missing.slice(index, index + 400).forEach((doc) => {
      const data = doc.data();
      const createdAt =
        data.claimedAt || data.transferredAt || data.updatedAt || new Date().toISOString();
      batch.update(doc.ref, {
        createdAt,
        updatedAt: data.updatedAt || createdAt,
      });
    });
    await batch.commit();
  }
}

console.log(
  JSON.stringify(
    {
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || null,
      scanned: snapshot.size,
      missingCreatedAt: missing.length,
      applied: apply,
    },
    null,
    2,
  ),
);
