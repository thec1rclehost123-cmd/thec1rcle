import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function normalizePrivateKey(raw?: string) {
  if (!raw) return raw;
  let privateKey = raw;
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.substring(1, privateKey.length - 1);
  }
  privateKey = privateKey.replace(/\\n/g, '\n').replace(/\\n/g, '\n').trim();
  if (!privateKey.endsWith('\n')) {
    privateKey += '\n';
  }
  return privateKey;
}

async function main() {
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  if (!privateKey) throw new Error('FIREBASE_PRIVATE_KEY is missing');

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
  }

  const db = getFirestore();

  const uid = 'furCmRhG0cWkjXUu87MS8uT68lj2';
  console.log(`Checking memberships for UID: ${uid}`);

  const snap = await db.collection('partner_memberships').where('uid', '==', uid).get();
  if (snap.empty) {
    console.log('No partner_memberships found.');
  } else {
    for (const doc of snap.docs) {
      console.log('MEMBERSHIP:', doc.id, JSON.stringify(doc.data(), null, 2));

      // Seed directly for this partnerId too!
      const partnerId = doc.data().partnerId;
      if (partnerId) {
        console.log(`\n>>> Seeding for partnerId from membership: ${partnerId}`);

        const eventRef = db.collection('events').doc();
        await eventRef.set({
          name: 'Neon Nights Summer Bash',
          title: 'Neon Nights Summer Bash',
          status: 'published',
          createdAt: new Date().toISOString(),
        });

        const orderRef = db.collection('orders').doc();
        await orderRef.set({
          eventId: eventRef.id,
          guestName: 'Membership Guest',
          buyerName: 'Membership Guest',
          amount: 2500,
          totalPaise: 250000,
          commissionRate: 0.1,
          status: 'paid',
          promoterCode: 'ALICE10',
          createdAt: new Date().toISOString(),
        });

        const ledgerRef = db.collection('partner_ledger').doc();
        await ledgerRef.set({
          entryId: ledgerRef.id,
          referenceId: orderRef.id,
          eventId: eventRef.id,
          type: 'promoter_commission',
          amount: 250,
          fromPartnerId: 'host_123',
          toPartnerId: partnerId,
          status: 'pending',
          settledAt: null,
          currency: 'INR',
          createdAt: new Date().toISOString(),
        });

        const orderRef2 = db.collection('orders').doc();
        await orderRef2.set({
          eventId: eventRef.id,
          guestName: 'Membership Guest 2',
          buyerName: 'Membership Guest 2',
          amount: 5000,
          totalPaise: 500000,
          commissionRate: 0.1,
          status: 'paid',
          promoterCode: 'BOB20',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
        });

        const ledgerRef2 = db.collection('partner_ledger').doc();
        await ledgerRef2.set({
          entryId: ledgerRef2.id,
          referenceId: orderRef2.id,
          eventId: eventRef.id,
          type: 'promoter_commission',
          amount: 500,
          fromPartnerId: 'host_123',
          toPartnerId: partnerId,
          status: 'settled',
          settledAt: new Date().toISOString(),
          currency: 'INR',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
        });

        const payoutRef = db.collection('payouts').doc();
        await payoutRef.set({
          payoutId: payoutRef.id,
          partnerId: partnerId,
          amount: 500,
          status: 'completed',
          completedAt: new Date().toISOString(),
          requestedAt: new Date().toISOString(),
          paymentMethod: 'bank_transfer',
          createdAt: new Date().toISOString(),
        });

        console.log(`Seeded partnerId: ${partnerId}`);
      }
    }
  }
}

main().catch(console.error);
