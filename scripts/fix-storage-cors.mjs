import fs from 'fs';
import path from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import dotenv from 'dotenv';

// Load .env.local from guest-portal
const envPath = path.resolve('apps/guest-portal/.env.local');
dotenv.config({ path: envPath });

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!projectId || !clientEmail || !privateKey) {
  console.error('Missing Firebase credentials in .env.local');
  process.exit(1);
}

// Clean private key
privateKey = privateKey.replace(/\\n/g, '\n');
if ((privateKey.startsWith('"') && privateKey.endsWith('"')) || (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
  privateKey = privateKey.slice(1, -1);
}

const app = initializeApp({
  credential: cert({
    projectId,
    clientEmail,
    privateKey,
  }),
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
});

async function setCors() {
  const bucket = getStorage(app).bucket();
  console.log(`Setting CORS for bucket: ${bucket.name}`);

  const corsConfiguration = [
    {
      origin: ['http://localhost:3000'],
      method: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
      responseHeader: ['Content-Type', 'Authorization', 'x-goog-meta-uid'],
      maxAgeSeconds: 3600,
    },
  ];

  try {
    await bucket.setCorsConfiguration(corsConfiguration);
    console.log('CORS configuration set successfully!');
  } catch (error) {
    console.error('Failed to set CORS:', error);
  }
}

setCors();
