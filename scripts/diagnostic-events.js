import { config } from "dotenv";
import { resolve } from "node:path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Load .env
config({ path: resolve(process.cwd(), ".env") });

const projectId = process.env.FIREBASE_PROJECT_ID || "thec1rcle-india";
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });

// Import listEvents
import { listEvents } from "./apps/partner-dashboard/lib/server/eventStore.js";

async function diagnostic() {
    console.log("🔍 DIAGNOSING EVENT VISIBILITY...");

    const venueId = "venue_NPpsWyAw";
    const events = await listEvents({ venueId, limit: 100 });

    console.log(`Found ${events.length} events for venue ${venueId}`);

    events.forEach(e => {
        console.log(` - [${e.id}] ${e.title} (Status: ${e.status}, Lifecycle: ${e.lifecycle}, isDeleted: ${e.isDeleted})`);
    });

    if (events.length === 0) {
        console.log("\n⚠️  No events found by listEvents. Checking raw Firestore query...");
        const db = getFirestore();
        const snap = await db.collection("events").where("venueId", "==", venueId).get();
        console.log(`Raw Firestore query found ${snap.size} events.`);

        if (snap.size > 0) {
            console.log("Raw documents exist but listEvents filter is likely excluding them.");
            const sample = snap.docs[0].data();
            console.log("Sample document fields:", Object.keys(sample));
        }
    }

    process.exit(0);
}

diagnostic().catch(console.error);
