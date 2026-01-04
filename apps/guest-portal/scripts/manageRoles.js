const { getAuth } = require('firebase-admin/auth');
const { initializeApp, cert } = require('firebase-admin/app');
const dotenv = require('dotenv');
const path = require('path');

// Load .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
    console.error('Missing Firebase credentials in .env.local');
    process.exit(1);
}

initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
});

const auth = getAuth();

const setRole = async (email, role) => {
    try {
        const user = await auth.getUserByEmail(email);
        await auth.setCustomUserClaims(user.uid, { role });
        console.log(`Successfully set role '${role}' for user: ${email} (${user.uid})`);

        // Force token refresh on next sign-in or by calling user.getIdToken(true) on client
        console.log('User must re-sign or refresh their token to see the changes.');
    } catch (error) {
        console.error('Error setting role:', error.message);
    }
};

const args = process.argv.slice(2);
const [email, role] = args;

if (!email || !role) {
    console.log('Usage: node scripts/manageRoles.js <email> <role>');
    console.log('Available roles: admin, club, host, promoter, user, staff');
    process.exit(0);
}

setRole(email, role);
