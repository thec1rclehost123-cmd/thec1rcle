
const admin = require('firebase-admin');

// Load env from one of the apps (they share the same config)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'apps/admin-console/.env.local') });

const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const uid = 'lk0mkE7nyvebFUeuKT2DeUygBpy2';
const newEmail = 'gaikwadatharva4440@gmail.com';

async function updateEmail() {
    try {
        await admin.auth().updateUser(uid, {
            email: newEmail
        });
        console.log('Successfully updated user email to:', newEmail);
    } catch (error) {
        console.error('Error updating user:', error);
    } finally {
        process.exit();
    }
}

updateEmail();
