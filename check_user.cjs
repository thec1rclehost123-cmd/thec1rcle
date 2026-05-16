const admin = require("firebase-admin");

const uid = process.argv[2];
if (!uid) { console.log("Usage: node check_user.cjs <uid>"); process.exit(1); }

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;
if (!projectId || !clientEmail || !privateKey) { console.log("Firebase env vars not set"); process.exit(1); }
if (privateKey.startsWith('"') && privateKey.endsWith('"')) privateKey = privateKey.slice(1, -1);
privateKey = privateKey.replace(/\\n/g, "\n");

admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });

admin.firestore().collection("users").doc(uid).get().then(doc => {
    if (!doc.exists) { console.log("User not found"); process.exit(1); }
    const d = doc.data();
    console.log("email:", d.email);
    console.log("role:", d.role);
    console.log("isApproved:", d.isApproved);
    console.log("onboardingRequestId:", d.onboardingRequestId || "❌ NOT SET");
    console.log("onboardingStep:", d.onboardingStep);
    console.log("entityType:", d.entityType);
    console.log("phone:", d.phone);
    console.log("createdAt:", d.createdAt?.toDate?.()?.toISOString() || d.createdAt);
    process.exit(0);
}).catch(e => { console.log("Error:", e.message); process.exit(1); });
