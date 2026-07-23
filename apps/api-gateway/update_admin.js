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

async function updateAdmin(email, password) {
  try {
    console.log(`--- Updating ${email} Admin Credentials ---`);

    let user;
    try {
      user = await auth.getUserByEmail(email);
      console.log(`✅ User found: ${user.uid}`);

      // Force update password
      await auth.updateUser(user.uid, {
        password: password,
        emailVerified: true,
      });
      console.log(`✅ Password updated to: ${password}`);
    } catch (e) {
      console.log(`⚠️ User not found, creating new admin user...`);
      user = await auth.createUser({
        email,
        password: password,
        emailVerified: true,
      });
      console.log(`✅ User created: ${user.uid}`);
    }

    // Set Custom Claims
    await auth.setCustomUserClaims(user.uid, {
      admin: true,
      role: 'admin',
      admin_role: 'super',
    });
    console.log(`✅ Custom claims set.`);

    // Ensure doc exists in 'admins' collection
    await db.collection('admins').doc(user.uid).set(
      {
        uid: user.uid,
        email: email,
        admin_role: 'super',
        role: 'admin',
        displayName: 'System Admin',
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    console.log(`✅ Firestore record updated.`);

    console.log(`\n🎉 DONE! Login to http://localhost:3002 with:`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    process.exit(0);
  } catch (error) {
    console.error(`❌ FAILED:`, error.message);
    process.exit(1);
  }
}

const email = process.argv[2];
if (!email) {
  console.error('Usage: node update_admin.js <email>');
  process.exit(1);
}

updateAdmin(email, 'Admin12345!');
