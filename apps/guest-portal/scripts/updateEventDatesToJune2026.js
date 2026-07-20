/**
 * Update Seed Events Dates to June 2026
 * 
 * Run this script from the guest-portal directory with Firebase credentials:
 * node scripts/updateEventDatesToJune2026.js
 */

require('dotenv').config({ path: '.env' });
const admin = require('firebase-admin');

// Event date updates - all moved to June 2026
const eventDateUpdates = {
    "after-dark-az": {
        date: "Fri, Jun 05",
        startDate: "2026-06-05T19:00:00.000Z",
        endDate: "2026-06-06T01:00:00.000Z",
        startDateTime: "2026-06-05T19:00:00+05:30",
        endDateTime: "2026-06-06T01:00:00+05:30"
    },
    "campus-cookout": {
        date: "Sat, Jun 13",
        startDate: "2026-06-13T16:00:00.000Z",
        endDate: "2026-06-13T21:00:00.000Z",
        startDateTime: "2026-06-13T16:00:00+05:30",
        endDateTime: "2026-06-13T21:00:00+05:30"
    },
    "lofi-rooftop": {
        date: "Sun, Jun 14",
        startDate: "2026-06-14T18:00:00.000Z",
        endDate: "2026-06-14T22:00:00.000Z",
        startDateTime: "2026-06-14T18:00:00+05:30",
        endDateTime: "2026-06-14T22:00:00+05:30"
    },
    "genz-night": {
        date: "Every Friday in June",
        startDate: "2026-06-05T22:00:00.000Z",
        endDate: "2026-06-06T03:00:00.000Z",
        startDateTime: "2026-06-05T22:00:00+05:30",
        endDateTime: "2026-06-06T03:00:00+05:30"
    },
    "diy-art-basement": {
        date: "Thu, Jun 04",
        startDate: "2026-06-04T20:00:00.000Z",
        endDate: "2026-06-05T00:00:00.000Z",
        startDateTime: "2026-06-04T20:00:00+05:30",
        endDateTime: "2026-06-05T00:00:00+05:30"
    },
    "riverfront-fit": {
        date: "Wed, Jun 10",
        startDate: "2026-06-10T07:00:00.000Z",
        endDate: "2026-06-10T09:00:00.000Z",
        startDateTime: "2026-06-10T07:00:00+05:30",
        endDateTime: "2026-06-10T09:00:00+05:30"
    },
    "house-of-synth": {
        date: "Fri, Jun 19",
        startDate: "2026-06-19T21:00:00.000Z",
        endDate: "2026-06-20T01:30:00.000Z",
        startDateTime: "2026-06-19T21:00:00+05:30",
        endDateTime: "2026-06-20T01:30:00+05:30"
    },
    "secret-brunch": {
        date: "Sun, Jun 21",
        startDate: "2026-06-21T11:00:00.000Z",
        endDate: "2026-06-21T15:00:00.000Z",
        startDateTime: "2026-06-21T11:00:00+05:30",
        endDateTime: "2026-06-21T15:00:00+05:30"
    },
    "cypher-sundays": {
        date: "Thursdays in June",
        startDate: "2026-06-18T20:00:00.000Z",
        endDate: "2026-06-18T23:00:00.000Z",
        startDateTime: "2026-06-18T20:00:00+05:30",
        endDateTime: "2026-06-18T23:00:00+05:30"
    },
    "lower-east-block": {
        date: "Fri, Jun 12",
        startDate: "2026-06-12T17:00:00.000Z",
        endDate: "2026-06-13T00:00:00.000Z",
        startDateTime: "2026-06-12T17:00:00+05:30",
        endDateTime: "2026-06-13T00:00:00+05:30"
    },
    "nirvana-night": {
        date: "Sun, Jun 07",
        startDate: "2026-06-07T20:00:00.000Z",
        endDate: "2026-06-07T23:30:00.000Z",
        startDateTime: "2026-06-07T20:00:00+05:30",
        endDateTime: "2026-06-07T23:30:00+05:30"
    },
    "sunset-social": {
        date: "Fri, Jun 26",
        startDate: "2026-06-26T18:00:00.000Z",
        endDate: "2026-06-26T21:30:00.000Z",
        startDateTime: "2026-06-26T18:00:00+05:30",
        endDateTime: "2026-06-26T21:30:00+05:30"
    },
    "honesty-lab": {
        date: "Mon, Jun 22",
        startDate: "2026-06-22T18:30:00.000Z",
        endDate: "2026-06-22T21:00:00.000Z",
        startDateTime: "2026-06-22T18:30:00+05:30",
        endDateTime: "2026-06-22T21:00:00+05:30"
    },
    "midnight-market": {
        date: "Sat, Jun 27",
        startDate: "2026-06-27T20:00:00.000Z",
        endDate: "2026-06-28T02:00:00.000Z",
        startDateTime: "2026-06-27T20:00:00+05:30",
        endDateTime: "2026-06-28T02:00:00+05:30"
    },
    "neon-horizon-gala": {
        date: "Sat, Jun 20",
        startDate: "2026-06-20T20:00:00.000Z",
        endDate: "2026-06-21T02:00:00.000Z",
        startDateTime: "2026-06-20T20:00:00+05:30",
        endDateTime: "2026-06-21T02:00:00+05:30"
    }
};

// Initialize Firebase Admin
let privateKey = process.env.FIREBASE_PRIVATE_KEY;
if (privateKey) {
    // Remove quotes if present
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.substring(1, privateKey.length - 1);
    }
    // Replace literal \n with actual newlines
    privateKey = privateKey.replace(/\\n/g, '\n');
    // Fix suspected typo \O -> \nO
    privateKey = privateKey.replace(/\\O/g, '\nO');
}

const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey,
};

if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
    console.error('Missing Firebase credentials in environment variables.');
    console.log('Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function updateEventDates() {
    console.log(`Updating ${Object.keys(eventDateUpdates).length} event dates to June 2026...`);

    const batch = db.batch();
    let updateCount = 0;

    for (const [eventId, updates] of Object.entries(eventDateUpdates)) {
        const docRef = db.collection('events').doc(eventId);
        const doc = await docRef.get();

        if (doc.exists) {
            batch.update(docRef, {
                ...updates,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            updateCount++;
            console.log(`  ✓ ${eventId} → ${updates.date}`);
        } else {
            console.log(`  ✗ ${eventId} not found in Firestore`);
        }
    }

    if (updateCount > 0) {
        await batch.commit();
        console.log(`\n✅ Updated ${updateCount} events to June 2026!`);
    } else {
        console.log('\n⚠️ No events were updated.');
    }
}

updateEventDates().catch(console.error).finally(() => process.exit());
