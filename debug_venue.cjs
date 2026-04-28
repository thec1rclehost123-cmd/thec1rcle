const fs = require('fs');
const admin = require('firebase-admin');

const env = fs.readFileSync('apps/partner-dashboard/.env', 'utf8');
const keyMatch = env.match(/FIREBASE_PRIVATE_KEY="([^"]+)"/);
const projectMatch = env.match(/FIREBASE_PROJECT_ID="([^"]+)"/);
const emailMatch = env.match(/FIREBASE_CLIENT_EMAIL="([^"]+)"/);

if (!keyMatch || !projectMatch || !emailMatch) {
    console.log("Missing credentials in .env");
    process.exit(1);
}

const privateKey = keyMatch[1].replace(/\\n/g, '\n');

admin.initializeApp({
    credential: admin.credential.cert({
        projectId: projectMatch[1],
        clientEmail: emailMatch[1],
        privateKey: privateKey
    })
});

const db = admin.firestore();

async function checkVenue() {
    const venueId = 'venue_lk0mkE7n';
    const doc = await db.collection('venues').doc(venueId).get();
    if (!doc.exists) {
        console.log(`Venue ${venueId} NOT FOUND`);
    } else {
        console.log(`Venue ${venueId} fields:`);
        console.log(JSON.stringify(doc.data(), null, 2));
    }

    console.log("\nSearching for all venues with 'Gaikwad' in name...");
    const snap = await db.collection('venues').where('name', '>=', 'Gaikwad').get();
    snap.forEach(d => console.log(d.id, d.data().name, d.data().image || d.data().coverURL));
}

checkVenue();
