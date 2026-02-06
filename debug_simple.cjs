const fs = require('fs');
const admin = require('firebase-admin');

const env = fs.readFileSync('apps/partner-dashboard/.env', 'utf8');
const keyLine = env.split('\n').find(l => l.startsWith('FIREBASE_PRIVATE_KEY='));
const projLine = env.split('\n').find(l => l.startsWith('FIREBASE_PROJECT_ID='));
const emailLine = env.split('\n').find(l => l.startsWith('FIREBASE_CLIENT_EMAIL='));

let pk = keyLine.split('=')[1];
if (pk.startsWith('"')) pk = pk.slice(1);
if (pk.endsWith('"')) pk = pk.slice(0, -1);
pk = pk.replace(/\\n/g, '\n');

admin.initializeApp({
    credential: admin.credential.cert({
        projectId: projLine.split('=')[1].replace(/"/g, ''),
        clientEmail: emailLine.split('=')[1].replace(/"/g, ''),
        privateKey: pk
    })
});

const db = admin.firestore();

async function checkVenue() {
    const vn = 'venue_lk0mkE7n';
    const doc = await db.collection('venues').doc(vn).get();
    if (!doc.exists) {
        console.log("NOT FOUND:", vn);
        const all = await db.collection('venues').limit(5).get();
        all.forEach(d => console.log(d.id, d.data().name));
    } else {
        console.log("FOUND:", vn);
        console.log(JSON.stringify(doc.data(), null, 2));
    }
}

checkVenue();
