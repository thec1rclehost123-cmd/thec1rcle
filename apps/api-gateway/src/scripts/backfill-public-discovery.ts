import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { PublicDiscoveryService } from '@c1rcle/core/public-discovery-service';

function normalizePrivateKey(raw?: string) {
    if (!raw) return raw;
    let privateKey = raw;
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.substring(1, privateKey.length - 1);
    }
    privateKey = privateKey.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n').trim();
    if (!privateKey.endsWith('\n')) {
        privateKey += '\n';
    }
    return privateKey;
}

async function main() {
    const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
    if (!privateKey) {
        throw new Error('FIREBASE_PRIVATE_KEY is missing or empty');
    }

    if (!getApps().length) {
        initializeApp({
            credential: cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey,
            }),
        });
    }

    const service = new PublicDiscoveryService(getFirestore());
    await service.bootstrapReadModels(console);
    console.info('[backfill-public-discovery] complete');
}

main().catch((error) => {
    console.error('[backfill-public-discovery] failed', error);
    process.exit(1);
});
