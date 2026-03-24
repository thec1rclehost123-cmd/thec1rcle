import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";
import path from "path";

// Try to load from various potential .env files
const paths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "apps/partner-dashboard/.env.development"),
    path.resolve(process.cwd(), "apps/partner-dashboard/.env.staging")
];

for (const p of paths) {
    dotenv.config({ path: p });
}

console.log(`Checking connection to: ${process.env.FIREBASE_PROJECT_ID || "(missing project id)"}`);

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (privateKey) {
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, "\n");
    console.log(`Parsed key snippet: ${privateKey.substring(0, 50)}...`);
}

try {
    const app = initializeApp({
        credential: cert({
            projectId,
            clientEmail,
            privateKey,
        }),
    });

    const db = getFirestore(app);
    console.log("Connected to Firestore. Fetching collections...");

    const collections = await db.listCollections();
    console.log(`Successfully fetched collections: ${collections.map(c => c.id).join(", ") || "(none)"}`);

    process.exit(0);
} catch (error) {
    console.error("FATAL CONNECTION ERROR:");
    console.error(error);
    process.exit(1);
}
