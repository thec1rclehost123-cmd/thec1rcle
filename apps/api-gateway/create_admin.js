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

async function createAdmin(email) {
  try {
    console.log(`--- Promoting ${email} to Admin ---`);

    // 1. Get or Create User
    let user;
    try {
      user = await auth.getUserByEmail(email);
      console.log(`✅ User found: ${user.uid}`);
    } catch (e) {
      console.log(
        `⚠️ User not found, creating dummy user (you should sign up first if possible)...`,
      );
      user = await auth.createUser({
        email,
        password: 'TemporaryPassword123!',
      });
      console.log(`✅ User created: ${user.uid}`);
    }

    // 2. Set Custom Claims
    await auth.setCustomUserClaims(user.uid, {
      admin: true,
      role: 'admin',
      admin_role: 'super',
    });
    console.log(`✅ Custom claims set: { admin: true, role: 'admin', admin_role: 'super' }`);

    // 3. Add to admins collection
    await db.collection('admins').doc(user.uid).set({
      uid: user.uid,
      email: email,
      role: 'super',
      displayName: 'System Admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log(`✅ Added to 'admins' collection in Firestore.`);

    console.log(`\n🎉 SUCCESS! You can now log in to the Admin Console with ${email}`);
    process.exit(0);
  } catch (error) {
    console.error(`❌ FAILED:`, error.message);
    process.exit(1);
  }
}

const email = process.argv[2];
if (!email) {
  console.error('Usage: node create_admin.js <email>');
  process.exit(1);
}

createAdmin(email);
