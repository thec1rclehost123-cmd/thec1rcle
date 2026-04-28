import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';

// Load env from admin-console
dotenv.config({ path: path.resolve(process.cwd(), 'apps/admin-console/.env.local') });

if (!getApps().length) {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (privateKey?.startsWith('"') && privateKey?.endsWith('"')) {
        privateKey = privateKey.substring(1, privateKey.length - 1);
    }
    privateKey = privateKey?.replace(/\\n/g, '\n');

    initializeApp({
        credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey,
        }),
    });
}

const auth = getAuth();
const db = getFirestore();

const EMAILS = [
    'bankar@gmail.com',
    'gaikwadatharva4440@gmail.com',
    'shrutitodmal444@gmail.com',
    'shrutifake612@gmail.com'
];

async function forceComplete() {
    for (const email of EMAILS) {
        try {
            console.log(`--- Force Completing Onboarding for ${email} ---`);
            const user = await auth.getUserByEmail(email);
            const uid = user.uid;

            // 1. Update user doc to mark onboarding as complete
            await db.collection('users').doc(uid).set({
                onboardingComplete: true,
                onboardingStatus: 'approved',
                phone: '+919876543210',
                emailVerified: true,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            // 2. Ensure a partner membership exists (Dashboard uses this for routing)
            const userDoc = await db.collection('users').doc(uid).get();
            const userData = userDoc.data();
            const partnerId = userData.venueId || userData.partnerId || 'v_system_test_01';

            // Create a membership record if needed
            await db.collection('memberships').doc(`${uid}_${partnerId}`).set({
                uid,
                partnerId,
                partnerType: userData.role === 'partner' ? 'venue' : userData.role,
                role: 'owner',
                status: 'active',
                createdAt: new Date().toISOString()
            }, { merge: true });

            console.log(`✅ ${email} is now fully onboarded and approved.`);
        } catch (e) {
            console.error(`❌ Error for ${email}:`, e.message);
        }
    }
    console.log(`\n🎉 DONE! All accounts should now go straight to their Dashboards.`);
    process.exit(0);
}

forceComplete();
