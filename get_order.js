import admin from 'firebase-admin';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
admin.initializeApp({ projectId: 'thec1rcle-india' });
const db = admin.firestore();
async function run() {
  const snaps = await db.collection('orders').orderBy('createdAt', 'desc').limit(1).get();
  snaps.forEach((doc) => {
    console.log(JSON.stringify(doc.data(), null, 2));
  });
}
run();
