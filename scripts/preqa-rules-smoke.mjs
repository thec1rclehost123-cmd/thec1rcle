import { initializeApp, deleteApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { connectStorageEmulator, getStorage, ref, uploadBytes } from 'firebase/storage';

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'c1rcle-preqa';
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199';

const app = initializeApp({
  apiKey: 'preqa-rules-smoke',
  authDomain: `${projectId}.firebaseapp.com`,
  projectId,
  storageBucket: `${projectId}.appspot.com`,
});

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
connectFirestoreEmulator(db, firestoreHost.split(':')[0], Number(firestoreHost.split(':')[1]));
connectStorageEmulator(storage, storageHost.split(':')[0], Number(storageHost.split(':')[1]));

const checks = [];

function record(label, status) {
  checks.push({ label, status });
  console.log(`${status === 'pass' ? 'PASS' : 'FAIL'} ${label}`);
}

function isPermissionDenied(error) {
  const message = String(error?.message || error);
  return (
    error?.code === 'permission-denied' ||
    error?.code === 'storage/unauthorized' ||
    message.includes('permission-denied') ||
    message.includes('storage/unauthorized') ||
    message.includes('does not have permission')
  );
}

async function expectAllowed(label, action) {
  try {
    await action();
    record(label, 'pass');
  } catch (error) {
    record(label, 'fail');
    throw error;
  }
}

async function expectDenied(label, action) {
  try {
    await action();
  } catch (error) {
    if (isPermissionDenied(error)) {
      record(label, 'pass');
      return;
    }
    record(label, 'fail');
    throw error;
  }
  record(label, 'fail');
  throw new Error(`${label} was unexpectedly allowed`);
}

async function createAndSignInRegularUser() {
  const email = `preqa-${Date.now()}@example.test`;
  const password = 'Preqa!12345';
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await signInWithEmailAndPassword(auth, email, password);
  return credential.user.uid;
}

async function seedFirestore(path, fields) {
  const url = `http://${firestoreHost}/v1/projects/${projectId}/databases/(default)/documents/${path}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer owner',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [key, toFirestoreValue(value)]),
      ),
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to seed ${path}: ${response.status} ${await response.text()}`);
  }
}

function toFirestoreValue(value) {
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (value && typeof value === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, nestedValue]) => [key, toFirestoreValue(nestedValue)]),
        ),
      },
    };
  }
  return { nullValue: null };
}

try {
  const uid = await createAndSignInRegularUser();

  await expectDenied('regular user cannot create privileged user fields', () =>
    setDoc(doc(db, 'users', uid), { displayName: 'Regular', role: 'admin' }),
  );
  await expectAllowed('regular user can create own safe user doc', () =>
    setDoc(doc(db, 'users', uid), { displayName: 'Regular' }),
  );
  await expectDenied('regular user cannot update privileged user fields', () =>
    updateDoc(doc(db, 'users', uid), { admin: true }),
  );
  await expectDenied('regular user cannot write events directly', () =>
    setDoc(doc(db, 'events', 'preqa-event'), { title: 'Blocked client write' }),
  );
  await expectDenied('regular user cannot write directMessages', () =>
    setDoc(doc(db, 'directMessages', 'preqa-message'), { senderId: uid, content: 'blocked' }),
  );

  await seedFirestore('directMessages/preqa-seeded-message', {
    conversationId: 'conversation-preqa',
    senderId: uid,
    content: 'seeded',
  });
  await expectDenied('regular user cannot read directMessages', () =>
    getDoc(doc(db, 'directMessages', 'preqa-seeded-message')),
  );

  await expectDenied('regular user cannot create cover wallets', () =>
    setDoc(doc(db, 'cover_wallets', 'wallet-preqa'), { userId: uid, balance: 100 }),
  );
  await expectDenied('regular user cannot write cover wallet txns', () =>
    setDoc(doc(db, 'cover_wallets', 'wallet-preqa', 'txns', 'txn-preqa'), {
      userId: uid,
      amount: 100,
    }),
  );

  await expectAllowed('owner can upload bounded profile photo image', () =>
    uploadBytes(
      ref(storage, `users/${uid}/photos/preqa.jpg`),
      new Blob(['image-bytes'], { type: 'image/jpeg' }),
    ),
  );
  await expectDenied('regular user cannot upload another user profile photo', () =>
    uploadBytes(
      ref(storage, 'users/someone-else/photos/preqa.jpg'),
      new Blob(['image-bytes'], { type: 'image/jpeg' }),
    ),
  );
  await expectDenied('owner cannot upload non-image profile file', () =>
    uploadBytes(
      ref(storage, `users/${uid}/photos/preqa.txt`),
      new Blob(['text'], { type: 'text/plain' }),
    ),
  );
  await expectDenied('owner cannot upload profile image larger than 5 MB', () =>
    uploadBytes(
      ref(storage, `users/${uid}/photos/preqa-large.jpg`),
      new Blob([new Uint8Array(5 * 1024 * 1024)], { type: 'image/jpeg' }),
    ),
  );
  await expectAllowed('owner can upload bounded KYC image', () =>
    uploadBytes(
      ref(storage, `kyc-documents/${uid}/preqa.jpg`),
      new Blob(['image-bytes'], { type: 'image/jpeg' }),
    ),
  );
  await expectDenied('regular user cannot write another user KYC image', () =>
    uploadBytes(
      ref(storage, 'kyc-documents/someone-else/preqa.jpg'),
      new Blob(['image-bytes'], { type: 'image/jpeg' }),
    ),
  );
  await expectDenied('regular user cannot upload event image', () =>
    uploadBytes(
      ref(storage, 'events/preqa.jpg'),
      new Blob(['image-bytes'], { type: 'image/jpeg' }),
    ),
  );

  const failures = checks.filter((check) => check.status !== 'pass');
  if (failures.length) process.exitCode = 1;
} finally {
  await deleteApp(app);
}
