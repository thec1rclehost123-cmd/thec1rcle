import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import path from 'path';

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
    const eventsSnap = await db.collection("events").limit(5).get();
    eventsSnap.forEach(doc => {
        const data = doc.data();
        console.log(`Event: ${doc.id} | Title: ${data.title} | WorkspaceID: ${data.workspaceId}`);
    });
}

check().catch(console.error);
