require('dotenv').config({ path: 'apps/partner-dashboard/.env' });
const admin = require('firebase-admin');
const { getStorage } = require('firebase-admin/storage');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "thec1rcle-india.firebasestorage.app"
    });
}

const bucket = getStorage().bucket();

async function listFiles() {
    console.log("Listing files in bucket:", bucket.name);
    try {
        const [files] = await bucket.getFiles({ prefix: 'venues/', maxResults: 50 });
        console.log(`Found ${files.length} files:`);
        files.forEach(file => {
            console.log(`- ${file.name} (${file.metadata.size} bytes)`);
        });
    } catch (err) {
        console.error("Error listing files:", err.message);
    }
}

listFiles();
