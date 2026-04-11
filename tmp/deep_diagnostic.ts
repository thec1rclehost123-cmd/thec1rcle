import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), 'apps/api-gateway/.env.development') });

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n');

initializeApp({
    credential: cert({
        projectId: "thec1rcle-india",
        clientEmail: "firebase-adminsdk-fbsvc@thec1rcle-india.iam.gserviceaccount.com",
        privateKey: privateKey,
    }),
});

const db = getFirestore();

async function check() {
    console.log("Deep Diagnostic: thec1rcle-india");
    const eventsSnap = await db.collection("events").get();
    console.log("Total Events:", eventsSnap.size);
    eventsSnap.forEach(doc => {
        const d = doc.data();
        console.log(`- [${doc.id}] Title: ${d.title} | Lifecycle: ${d.lifecycle} | Status: ${d.status} | Workspace: ${d.workspaceId} | isDeleted: ${d.isDeleted}`);
    });
}

check().catch(console.error);
