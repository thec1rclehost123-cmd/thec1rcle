/**
 * One-time migration: Backfill onboardingRequestId on existing user docs.
 *
 * Iterates all onboarding_requests and stores the requestId on the
 * corresponding user doc so getGuestOnboardingRequest can do a direct
 * document lookup instead of a Firestore query (which needs an index).
 *
 * Usage:
 *   node migrate_onboarding_request_id.cjs
 *
 * Requires Firebase Admin env vars:
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */

const admin = require("firebase-admin");

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!projectId || !clientEmail || !privateKey) {
    console.log("\n❌ Firebase Admin credentials not found.\n");
    process.exit(1);
}

if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
}
privateKey = privateKey.replace(/\\n/g, "\n");

async function migrate() {
    if (admin.apps.length === 0) {
        admin.initializeApp({
            credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
        });
    }

    const db = admin.firestore();

    // Get all onboarding requests
    const reqs = await db.collection("onboarding_requests").get();
    console.log(`Found ${reqs.size} onboarding requests.`);

    let updated = 0;
    let skipped = 0;

    for (const doc of reqs.docs) {
        const data = doc.data();
        const uid = data.uid;
        if (!uid) { skipped++; continue; }

        // Check if user already has onboardingRequestId
        const userDoc = await db.collection("users").doc(uid).get();
        if (!userDoc.exists) { skipped++; continue; }
        if (userDoc.data()?.onboardingRequestId) { skipped++; continue; }

        // Backfill the field
        await db.collection("users").doc(uid).set(
            { onboardingRequestId: doc.id },
            { merge: true }
        );
        updated++;
        console.log(`  ✅ ${uid.slice(0, 16)}... → ${doc.id}`);
    }

    console.log(`\nDone. ${updated} updated, ${skipped} skipped.`);
    process.exit(0);
}

migrate().catch((err) => {
    console.error("❌ Failed:", err.message);
    process.exit(1);
});
