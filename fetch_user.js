import admin from 'firebase-admin';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
admin.initializeApp({ projectId: 'thec1rcle-india' });

async function main() {
  const db = admin.firestore();
  const doc = await db.collection('users').doc('h8ktZ5jmXselI6vxkcMHc45YceP2').get();
  console.log(JSON.stringify(doc.data(), null, 2));
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
