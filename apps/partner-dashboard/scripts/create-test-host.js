const admin = require('firebase-admin');

function getCredentials() {
    const envKey = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (envKey) {
        try {
            return admin.credential.cert(JSON.parse(envKey));
        } catch {
            throw new Error("FIREBASE_SERVICE_ACCOUNT must be a valid JSON string");
        }
    }
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (credPath) {
        return admin.credential.applicationDefault();
    }
    throw new Error("Set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS env var");
}

if (!admin.apps.length) {
    admin.initializeApp({ credential: getCredentials() });
}

const db = admin.firestore();
const auth = admin.auth();

async function setup() {
    const email = 'host@thec1rcle.com';
    const password = 'Host123!';

    let uid;

    try {
        console.log('Checking for existing user...');
        const user = await auth.getUserByEmail(email);
        uid = user.uid;
        console.log('User exists, updating password...');
        await auth.updateUser(uid, { password });
    } catch (e) {
        console.log('Creating new user...');
        const user = await auth.createUser({
            email,
            password,
            displayName: 'Demo Host'
        });
        uid = user.uid;
    }

    console.log(`Setting up Firestore profile for ${uid}...`);
    // Set User Profile
    await db.collection('users').doc(uid).set({
        email,
        displayName: 'Demo Host',
        role: 'host',
        hostId: uid,
        createdAt: new Date().toISOString()
    }, { merge: true });

    console.log('Setup Complete.');
    console.log('-------------------------');
    console.log('Login Email:    ', email);
    console.log('Login Password: ', password);
    console.log('-------------------------');
}

setup().catch(console.error);
