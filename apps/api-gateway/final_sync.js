import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';

// Load env from api-gateway
dotenv.config({ path: path.resolve(process.cwd(), 'apps/api-gateway/.env.development') });

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

const ACCOUNTS = [
  { email: 'bankar@gmail.com', type: 'venue', partnerRole: 'owner', partnerId: 'v_system_test_01' },
  {
    email: 'gaikwadatharva4440@gmail.com',
    type: 'venue',
    partnerRole: 'owner',
    partnerId: 'v_atharva_club_01',
  },
  {
    email: 'shrutitodmal444@gmail.com',
    type: 'host',
    partnerRole: 'owner',
    partnerId: 'h_shruti_host_01',
  },
  {
    email: 'shrutifake612@gmail.com',
    type: 'promoter',
    partnerRole: 'owner',
    partnerId: 'p_shruti_promo_01',
  },
  {
    email: 'aayushdivase2020333@gmail.com',
    type: 'admin',
    partnerRole: 'owner',
    partnerId: 'admin_01',
  },
];

async function finalSync() {
  for (const acc of ACCOUNTS) {
    try {
      console.log(`--- Final Syncing ${acc.email} ---`);
      const user = await auth.getUserByEmail(acc.email);
      const uid = user.uid;

      // 1. Set EXACT Custom Claims expected by DashboardAuthProvider.tsx
      const claims = {
        partnerId: acc.partnerId,
        partnerType: acc.type === 'venue' ? 'venue' : acc.type,
        partnerRole: acc.partnerRole, // MUST be 'partnerRole' not 'role'
        role: acc.type === 'admin' ? 'admin' : 'partner',
        admin: acc.type === 'admin',
        admin_role: acc.type === 'admin' ? 'super' : null,
      };
      await auth.setCustomUserClaims(uid, claims);
      console.log(`✅ Claims updated.`);

      // 2. Set EXACT Firestore fields
      const update = {
        uid,
        email: acc.email,
        isApproved: true,
        onboardingComplete: true,
        onboardingStatus: 'approved',
        role: claims.role,
        venueId: acc.partnerId, // Legacy support
        partnerId: acc.partnerId,
        partnerType: claims.partnerType,
        updatedAt: new Date().toISOString(),
      };
      await db.collection('users').doc(uid).set(update, { merge: true });

      // 3. Ensure a Membership record exists in both memberships and partner_memberships
      const membershipDoc = {
        uid,
        partnerId: acc.partnerId,
        partnerType: claims.partnerType,
        role: acc.partnerRole,
        status: 'active',
        isActive: true,
        joinedAt: Date.now(),
        createdAt: new Date().toISOString(),
      };
      await db
        .collection('memberships')
        .doc(`${uid}_${acc.partnerId}`)
        .set(membershipDoc, { merge: true });
      await db
        .collection('partner_memberships')
        .doc(`${uid}_${acc.partnerId}`)
        .set(membershipDoc, { merge: true });

      console.log(`✅ Sync complete for ${acc.email}`);
    } catch (e) {
      console.error(`❌ Error for ${acc.email}:`, e.message);
    }
  }
  console.log(`\n🎉 FINAL SYNC COMPLETE! All field names are now perfectly matched.`);
  process.exit(0);
}

finalSync();
