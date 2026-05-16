const admin = require("firebase-admin");

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;
if (!projectId || !clientEmail || !privateKey) { console.log("Firebase env vars not set"); process.exit(1); }
if (privateKey.startsWith('"') && privateKey.endsWith('"')) privateKey = privateKey.slice(1, -1);
privateKey = privateKey.replace(/\\n/g, "\n");

admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });

const EXPECTED = [
    "uid", "email", "displayName", "photoURL", "phone",
    "role", "isApproved", "onboardingComplete",
    "createdAt", "updatedAt",
];

const STANDARD = ["dateOfBirth", "gender", "notificationSettings", "interests"];
const CUSTOM = ["businessType","registrationNumber","contactPerson","city","area","website","capacity","plan",
    "entityType","instagram","bio","onboardingRole","onboardingRequestId","onboardingStep"];

async function check() {
    const snap = await admin.firestore().collection("users").orderBy("createdAt", "desc").limit(10).get();
    console.log(`\nChecking ${snap.size} recent users...\n`);

    snap.docs.forEach(doc => {
        const d = doc.data();
        const email = d.email || doc.id.slice(0, 16);
        const missing = EXPECTED.filter(f => d[f] === undefined).join(", ");
        const hasStandard = STANDARD.filter(f => d[f] !== undefined).join(", ");
        const hasCustom = CUSTOM.filter(f => d[f] !== undefined).join(", ");
        const extra = Object.keys(d).filter(k => !EXPECTED.includes(k) && !STANDARD.includes(k) && !CUSTOM.includes(k)).join(", ");

        console.log(`${email.padEnd(32)} | role:${(d.role||"-").padEnd(12)} | approved:${String(d.isApproved??"-").padEnd(5)} | missing: ${missing || "none"}`);
        if (hasStandard) console.log(`    standard fields present: ${hasStandard}`);
        if (hasCustom) console.log(`    custom fields present: ${hasCustom}`);
        if (extra) console.log(`    extra fields: ${extra}`);
    });

    // Summary
    const allDocs = await admin.firestore().collection("users").get();
    let missingCounts = {};
    EXPECTED.forEach(f => missingCounts[f] = 0);
    allDocs.docs.forEach(doc => {
        const d = doc.data();
        EXPECTED.forEach(f => { if (d[f] === undefined) missingCounts[f]++; });
    });
    console.log(`\n--- Missing field counts (out of ${allDocs.size} users) ---`);
    EXPECTED.forEach(f => {
        if (missingCounts[f] > 0) console.log(`  ${f}: missing in ${missingCounts[f]} users`);
    });

    process.exit(0);
}
check().catch(e => { console.log("Error:", e.message); process.exit(1); });
