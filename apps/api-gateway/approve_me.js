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

async function linkAndApprove(email) {
    try {
        console.log(`--- Linking and Approving ${email} ---`);
        
        const user = await auth.getUserByEmail(email);
        const uid = user.uid;
        console.log(`✅ Found user: ${uid}`);

        // 1. Find the onboarding request for this email
        const reqSnapshot = await db.collection('onboarding_requests')
            .where('email', '==', email)
            .limit(1)
            .get();

        if (reqSnapshot.empty) {
            console.log(`⚠️ No onboarding request found for ${email}. Creating a fake one to bypass...`);
            await db.collection('onboarding_requests').add({
                email,
                uid,
                status: 'approved',
                type: 'venue',
                name: 'System Auto-Approve',
                createdAt: new Date().toISOString(),
                reviewedAt: new Date().toISOString()
            });
        } else {
            const reqDoc = reqSnapshot.docs[0];
            await reqDoc.ref.update({
                uid: uid,
                status: 'approved',
                reviewedAt: new Date().toISOString()
            });
            console.log(`✅ Onboarding request ${reqDoc.id} linked and approved.`);
        }

        // 2. Promote user to Partner role so the Dashboard accepts them
        await auth.setCustomUserClaims(uid, {
            admin: true,
            role: 'partner',
            partnerId: 'v_system_test_01',
            partnerType: 'venue',
            partnerRole: 'OWNER',
            admin_role: 'super'
        });
        
        // 3. Update user doc
        await db.collection('users').doc(uid).set({
            uid,
            email,
            role: 'partner',
            venueId: 'v_system_test_01', // Give them a dummy venue ID so they can enter the dashboard
            updatedAt: new Date().toISOString()
        }, { merge: true });

        // 4. Create the venue doc if it doesn't exist
        await db.collection('venues').doc('v_system_test_01').set({
            id: 'v_system_test_01',
            name: 'My Awesome Venue',
            ownerId: uid,
            status: 'active',
            createdAt: new Date().toISOString()
        }, { merge: true });

        console.log(`✅ User promoted to 'partner' with venue 'v_system_test_01'.`);
        console.log(`\n🎉 ALL DONE! You can now log into BOTH:`);
        console.log(`1. Admin Console (http://localhost:3002)`);
        console.log(`2. Partner Dashboard (http://localhost:3001)`);
        process.exit(0);
    } catch (error) {
        console.error(`❌ FAILED:`, error.message);
        process.exit(1);
    }
}

linkAndApprove('bankar@gmail.com');
