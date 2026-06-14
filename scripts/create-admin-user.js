
import { existsSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { resolve } from "node:path";
import { config } from "dotenv";

// Load environment from apps/admin-console/.env.staging or .env.development
let envPath = resolve(process.cwd(), "apps/admin-console/.env.staging");
if (!existsSync(envPath)) {
    envPath = resolve(process.cwd(), "apps/admin-console/.env.development");
}
config({ path: envPath });

console.log(`📂 Loading environment from: ${envPath}`);
console.log(`🎯 Target Project: ${process.env.FIREBASE_PROJECT_ID}`);

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, "\n");
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
    }
    let body = privateKey
        .replace(/-----BEGIN PRIVATE KEY-----/g, "")
        .replace(/-----END PRIVATE KEY-----/g, "");
    body = body.replace(/[^a-zA-Z0-9+/=]/g, "");
    const formattedBody = body.match(/.{1,64}/g)?.join("\n");
    if (formattedBody) {
        privateKey = `-----BEGIN PRIVATE KEY-----\n${formattedBody}\n-----END PRIVATE KEY-----\n`;
    }
}

const app = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId
});

const auth = getAuth(app);
const db = getFirestore(app);

const ADMIN_EMAIL = "aayushdivase2020333@gmail.com";
const ADMIN_PWD = "Aayush2023333";
const ADMIN_NAME = "Aayush Admin";

async function run() {
    console.log("🔍 Running Diagnostics...");

    try {
        console.log("1. Testing Firestore connectivity...");
        const collections = await db.listCollections();
        console.log(`✅ Firestore is accessible. Collections found: ${collections.map(c => c.id).join(", ")}`);
    } catch (err) {
        console.error("❌ Firestore Error:", err.message);
    }

    console.log(`\n🚀 Setting up Admin User: ${ADMIN_EMAIL}...`);

    let user;
    try {
        user = await auth.getUserByEmail(ADMIN_EMAIL);
        console.log(`✅ User already exists (uid: ${user.uid}). Updating password...`);
        await auth.updateUser(user.uid, {
            password: ADMIN_PWD,
            displayName: ADMIN_NAME
        });
    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            console.log(`🆕 User not found. Creating new user...`);
            user = await auth.createUser({
                email: ADMIN_EMAIL,
                password: ADMIN_PWD,
                displayName: ADMIN_NAME,
                emailVerified: true
            });
            console.log(`✅ User created (uid: ${user.uid}).`);
        } else {
            console.error("❌ Auth Error Details:", JSON.stringify(error, null, 2));
            throw error;
        }
    }

    // Set role in Firestore
    console.log(`🔧 Setting role: admin in Firestore 'users' collection...`);
    await db.collection("users").doc(user.uid).set({
        uid: user.uid,
        email: ADMIN_EMAIL,
        displayName: ADMIN_NAME,
        role: "admin",
        admin_role: "super",
        status: "active",
        createdAt: user.metadata?.creationTime || new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }, { merge: true });

    // Set Custom Claims for withAdminAuth middleware
    console.log(`🛡️  Setting custom claims: role=admin, admin_role=super, admin=true...`);
    await auth.setCustomUserClaims(user.uid, {
        role: "admin",
        admin_role: "super",
        admin: true
    });

    console.log(`\n🎉 SUCCESS: Admin account is ready with custom claims!`);
}

run().catch(err => {
    console.error("\n❌ FAILED:", err.message);
    process.exit(1);
});
