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

async function deepReset(email) {
    try {
        console.log(`--- Deep Resetting ${email} ---`);
        
        let user;
        try {
            user = await auth.getUserByEmail(email);
            console.log(`🗑 Found existing user ${user.uid}, updating...`);
        } catch (e) {
            console.log(`Creating new user...`);
            user = await auth.createUser({
                email,
                password: 'Admin12345!',
                emailVerified: true
            });
        }

        const uid = user.uid;

        // 1. Force set custom claims (CRITICAL for Dashboard access)
        await auth.setCustomUserClaims(uid, {
            admin: true,
            role: 'partner',
            partnerId: 'v_system_test_01',
            partnerType: 'venue',
            admin_role: 'super'
        });
        console.log(`✅ Custom claims injected.`);

        // 2. Set Firestore user doc
        await db.collection('users').doc(uid).set({
            uid,
            email,
            role: 'partner',
            venueId: 'v_system_test_01',
            partnerId: 'v_system_test_01',
            onboardingStatus: 'approved',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        console.log(`✅ Firestore user doc created.`);

        // 3. Ensure venue exists
        await db.collection('venues').doc('v_system_test_01').set({
            id: 'v_system_test_01',
            name: 'The C1rcle India Venue',
            ownerId: uid,
            status: 'active',
            type: 'club',
            createdAt: new Date().toISOString()
        }, { merge: true });
        console.log(`✅ Venue record verified.`);

        console.log(`\n🎉 DEEP RESET COMPLETE!`);
        console.log(`Use: bankar@gmail.com / Admin12345!`);
        process.exit(0);
    } catch (error) {
        console.error(`❌ FAILED:`, error.message);
        process.exit(1);
    }
}

deepReset('bankar@gmail.com');
