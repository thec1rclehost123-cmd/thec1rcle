/**
 * Debug script: List all registered users from Firestore.
 *
 * Usage:
 *   node debug_users.cjs
 *
 * Requires Firebase Admin credentials. Set these env vars before running:
 *   set FIREBASE_PROJECT_ID=your-project-id
 *   set FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
 *   set FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
 *   node debug_users.cjs
 */

const admin = require("firebase-admin");

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!projectId || !clientEmail || !privateKey) {
    console.log("\n❌ Firebase Admin credentials not found in environment.\n");
    console.log("   Set these environment variables before running:\n");
    console.log("   Windows (PowerShell):");
    console.log('     $env:FIREBASE_PROJECT_ID = "thec1rcle-india"');
    console.log('     $env:FIREBASE_CLIENT_EMAIL = "firebase-adminsdk-xxx@thec1rcle-india.iam.gserviceaccount.com"');
    console.log('     $env:FIREBASE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"');
    console.log("     node debug_users.cjs\n");
    console.log("   Or create apps/partner-dashboard/.env.local with:\n");
    console.log("   FIREBASE_PROJECT_ID=thec1rcle-india");
    console.log('   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@thec1rcle-india.iam.gserviceaccount.com');
    console.log('   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"');
    console.log("\n   (Get the values from your Firebase Console > Project Settings > Service Accounts)\n");
    process.exit(1);
}

if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
}
privateKey = privateKey.replace(/\\n/g, "\n");

async function listUsers() {
    if (admin.apps.length === 0) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey,
            }),
        });
    }

    const db = admin.firestore();
    const snapshot = await db.collection("users")
        .orderBy("createdAt", "desc")
        .limit(200)
        .get();

    console.log(`\n📋 Total users: ${snapshot.size}\n`);
    console.log("=".repeat(130));
    console.log(
        "  #".padEnd(4) +
        "UID".padEnd(28) +
        "EMAIL".padEnd(32) +
        "NAME".padEnd(22) +
        "PHONE".padEnd(18) +
        "ROLE".padEnd(14) +
        "APPROVED"
    );
    console.log("=".repeat(130));

    snapshot.docs.forEach((doc, i) => {
        const u = doc.data();
        const uid = doc.id.slice(0, 24);
        const email = (u.email || "—").slice(0, 30);
        const name = (u.displayName || u.name || "—").slice(0, 20);
        const phone = (u.phone || u.phoneNumber || "—").slice(0, 16);
        const role = (u.role || "user").slice(0, 12);
        const approved = u.isApproved ? "YES" : u.isApproved === false ? "PENDING" : "—";
        console.log(` ${String(i + 1).padStart(2)}. ${uid.padEnd(26)} ${email.padEnd(30)} ${name.padEnd(20)} ${phone.padEnd(16)} ${role.padEnd(12)} ${approved}`);
    });

    console.log("=".repeat(130));

    if (snapshot.docs.length > 0) {
        console.log("\n📄 Raw data of newest user:\n");
        const raw = snapshot.docs[0].data();
        delete raw.password;
        console.log(JSON.stringify(raw, null, 2));
    }

    process.exit(0);
}

listUsers().catch((err) => {
    console.error("❌ Failed:", err.message);
    process.exit(1);
});
