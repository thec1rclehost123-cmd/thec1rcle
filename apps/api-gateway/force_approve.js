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
  'shrutifake612@gmail.com',
];

async function forceApprove() {
  for (const email of EMAILS) {
    try {
      console.log(`--- Flipping isApproved Switch for ${email} ---`);
      const user = await auth.getUserByEmail(email);
      const uid = user.uid;

      // CRITICAL: Set isApproved to true on the user profile
      await db.collection('users').doc(uid).set(
        {
          isApproved: true,
          onboardingComplete: true,
          onboardingStatus: 'approved',
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );

      console.log(`✅ ${email} is now MASTER APPROVED.`);
    } catch (e) {
      console.error(`❌ Error for ${email}:`, e.message);
    }
  }
  console.log(`\n🎉 MASTER SWITCH FLIPPED! Try logging in now.`);
  process.exit(0);
}

forceApprove();
