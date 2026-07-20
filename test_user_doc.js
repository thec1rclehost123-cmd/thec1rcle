import { getAdminDb } from './packages/core/admin.js';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
const db = getAdminDb();

async function main() {
  const doc = await db.collection('users').doc('h8ktZ5jmXselI6vxkcMHc45YceP2').get();
  console.log(JSON.stringify(doc.data(), null, 2));
}

main().catch(console.error);
