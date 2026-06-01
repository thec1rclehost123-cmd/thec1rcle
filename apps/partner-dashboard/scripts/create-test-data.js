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

admin.initializeApp({ credential: getCredentials() });

const db = admin.firestore();
const auth = admin.auth();

async function setup() {
    const email = 'manager@thec1rcle.com';
    const password = 'Manager123!';
    const venueId = 'THE_CIRCLE_CLUB';

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
            displayName: 'Demo Manager'
        });
        uid = user.uid;
    }

    console.log(`Setting up Firestore profile for ${uid}...`);
    // Set User Profile
    await db.collection('users').doc(uid).set({
        email,
        displayName: 'Demo Manager',
        role: 'club_manager',
        venueId: venueId,
        createdAt: new Date().toISOString()
    }, { merge: true });

    // Create Venue
    await db.collection('venues').doc(venueId).set({
        name: 'The C1rcle Venue (Demo)',
        city: 'Pune',
        address: 'Kalyani Nagar',
        isActive: true,
        ownerId: uid
    }, { merge: true });

    console.log('Setup Complete.');
    console.log('-------------------------');
    console.log('Login Email:    ', email);
    console.log('Login Password: ', password);
    console.log('-------------------------');
}

setup().catch(console.error);
