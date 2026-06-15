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

const ACCOUNTS = [
  {
    email: 'gaikwadatharva4440@gmail.com',
    password: 'Atharva123!',
    type: 'venue',
    role: 'partner',
    partnerId: 'v_atharva_club_01',
  },
  {
    email: 'shrutitodmal444@gmail.com',
    password: 'Shruti@484',
    type: 'host',
    role: 'host',
    partnerId: 'h_shruti_host_01',
  },
  {
    email: 'shrutifake612@gmail.com',
    password: 'Shruti@484',
    type: 'promoter',
    role: 'promoter',
    partnerId: 'p_shruti_promo_01',
  },
  {
    email: 'aayushdivase2020333@gmail.com',
    password: 'Aayush2023333',
    type: 'admin',
    role: 'admin',
    admin_role: 'super',
  },
];

async function migrate() {
  for (const acc of ACCOUNTS) {
    try {
      console.log(`--- Migrating ${acc.email} (${acc.type}) ---`);

      let user;
      try {
        user = await auth.getUserByEmail(acc.email);
        console.log(`✅ User exists: ${user.uid}`);
        await auth.updateUser(user.uid, { password: acc.password, emailVerified: true });
      } catch (e) {
        user = await auth.createUser({
          email: acc.email,
          password: acc.password,
          emailVerified: true,
        });
        console.log(`✅ Created user: ${user.uid}`);
      }

      const uid = user.uid;

      // 1. Set Custom Claims
      const claims = {
        role: acc.role,
        ...(acc.partnerId && { partnerId: acc.partnerId, partnerType: acc.type }),
        ...(acc.type === 'admin' && { admin: true, admin_role: 'super' }),
      };
      await auth.setCustomUserClaims(uid, claims);
      console.log(`✅ Claims set: ${JSON.stringify(claims)}`);

      // 2. Update Firestore User Doc
      const userDoc = {
        uid,
        email: acc.email,
        role: acc.role,
        ...(acc.type === 'venue' && { venueId: acc.partnerId }),
        ...(acc.partnerId && { partnerId: acc.partnerId }),
        updatedAt: new Date().toISOString(),
      };
      await db.collection('users').doc(uid).set(userDoc, { merge: true });
      console.log(`✅ Firestore user doc updated.`);

      // 3. Ensure Entity exists
      if (acc.type === 'venue') {
        await db
          .collection('venues')
          .doc(acc.partnerId)
          .set(
            { id: acc.partnerId, name: 'Atharva Club', ownerId: uid, status: 'active' },
            { merge: true },
          );
      } else if (acc.type === 'host') {
        await db
          .collection('hosts')
          .doc(acc.partnerId)
          .set(
            { id: acc.partnerId, name: 'Shruti Host', userId: uid, status: 'active' },
            { merge: true },
          );
      } else if (acc.type === 'promoter') {
        await db
          .collection('promoters')
          .doc(acc.partnerId)
          .set(
            { id: acc.partnerId, name: 'Shruti Promoter', userId: uid, status: 'active' },
            { merge: true },
          );
      } else if (acc.type === 'admin') {
        await db
          .collection('admins')
          .doc(uid)
          .set(
            { uid, email: acc.email, role: 'super', displayName: 'Aayush Admin' },
            { merge: true },
          );
      }
      console.log(`✅ Entity record verified.`);
    } catch (error) {
      console.error(`❌ Error migrating ${acc.email}:`, error.message);
    }
  }
  console.log(
    `\n🎉 MIGRATION COMPLETE! All accounts are now compatible with the Strict API Layer.`,
  );
  process.exit(0);
}

migrate();
