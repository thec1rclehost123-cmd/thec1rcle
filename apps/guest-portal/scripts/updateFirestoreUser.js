const admin = require("firebase-admin");
const path = require("path");

const serviceAccountPath = path.resolve(__dirname, "../../Downloads/thec1rcle-india-firebase-adminsdk-fbsvc-7a42d7c601.json");
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function updateFirestoreUser(uid) {
    try {
        const userRef = db.collection('users').doc(uid);
        await userRef.set({
            role: 'admin',
            admin_role: 'super',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log(`Successfully updated Firestore document for UID: ${uid}`);
    } catch (e) {
        console.error(`Error updating Firestore: ${e.message}`);
    }
}

const args = process.argv.slice(2);
if (args.length < 1) {
    console.log("Usage: node updateFirestoreUser.js <uid>");
    process.exit(1);
}

updateFirestoreUser(args[0]);
