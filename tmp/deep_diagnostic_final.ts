import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), 'apps/api-gateway/.env.development') });

let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (privateKey?.startsWith('"') && privateKey?.endsWith('"')) {
    privateKey = privateKey.substring(1, privateKey.length - 1);
}
privateKey = privateKey?.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n');

initializeApp({
    credential: cert({
        projectId: "thec1rcle-india",
        clientEmail: "firebase-adminsdk-fbsvc@thec1rcle-india.iam.gserviceaccount.com",
        privateKey: privateKey,
    }),
});

const db = getFirestore();

async function check() {
    console.log("Deep Diagnostic (Fixed Parsing): thec1rcle-india");
    const eventsSnap = await db.collection("events").get();
    console.log("Total Events Found:", eventsSnap.size);
    eventsSnap.forEach(doc => {
        const d = doc.data();
        console.log(`- [${doc.id}] Title: ${d.title} | Lifecycle: ${d.lifecycle} | Status: ${d.status} | Workspace: ${d.workspaceId}`);
    });
}

check().catch(console.error);
