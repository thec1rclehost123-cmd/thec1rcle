import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import path from 'path';

// Load api-gateway env
dotenv.config({ path: path.join(process.cwd(), 'apps/api-gateway/.env.development') });

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n');

initializeApp({
    credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
    }),
});

const db = getFirestore();

async function check() {
    console.log("Checking Project:", process.env.FIREBASE_PROJECT_ID);
    const eventsSnap = await db.collection("events").limit(5).get();
    console.log("Events count:", eventsSnap.size);
    if (eventsSnap.size > 0) {
        eventsSnap.forEach(doc => {
            console.log("Event:", doc.id, doc.data().title);
        });
    } else {
        console.log("NO EVENTS FOUND in thec1rcle-india");
    }
}

check().catch(console.error);
