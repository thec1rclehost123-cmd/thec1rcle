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
    
    const usersSnap = await db.collection('users').get();
    if (usersSnap.empty) {
        console.log("No users found.");
        return;
    }

    console.log(`Seeding payouts for ${usersSnap.size} users...`);

    // Create a mock event
    const eventRef = db.collection('events').doc();
    await eventRef.set({
        name: "Neon Nights Summer Bash",
        title: "Neon Nights Summer Bash",
        status: "published",
        createdAt: new Date().toISOString()
    });

    for (const doc of usersSnap.docs) {
        const promoterId = doc.id;
        
        // Mock Order 1 (Pending Commission)
        const orderRef = db.collection('orders').doc();
        await orderRef.set({
            eventId: eventRef.id,
            guestName: "Alice Wonderland",
            buyerName: "Alice Wonderland",
            amount: 2500,
            totalPaise: 250000,
            commissionRate: 0.1,
            status: "paid",
            promoterCode: "ALICE10",
            createdAt: new Date().toISOString()
        });

        const ledgerRef = db.collection('partner_ledger').doc();
        await ledgerRef.set({
            entryId: ledgerRef.id,
            referenceId: orderRef.id,
            eventId: eventRef.id,
            type: 'promoter_commission',
            amount: 250,
            fromPartnerId: 'host_123',
            toPartnerId: promoterId,
            status: 'pending',
            settledAt: null,
            currency: 'INR',
            createdAt: new Date().toISOString()
        });

        // Mock Order 2 (Settled Commission)
        const orderRef2 = db.collection('orders').doc();
        await orderRef2.set({
            eventId: eventRef.id,
            guestName: "Bob Builder",
            buyerName: "Bob Builder",
            amount: 5000,
            totalPaise: 500000,
            commissionRate: 0.1,
            status: "paid",
            promoterCode: "BOB20",
            createdAt: new Date(Date.now() - 86400000).toISOString() // 1 day ago
        });

        const ledgerRef2 = db.collection('partner_ledger').doc();
        await ledgerRef2.set({
            entryId: ledgerRef2.id,
            referenceId: orderRef2.id,
            eventId: eventRef.id,
            type: 'promoter_commission',
            amount: 500,
            fromPartnerId: 'host_123',
            toPartnerId: promoterId,
            status: 'settled',
            settledAt: new Date().toISOString(),
            currency: 'INR',
            createdAt: new Date(Date.now() - 86400000).toISOString()
        });

        // Add a mock payout record so the "Paid" row shows up
        const payoutRef = db.collection('payouts').doc();
        await payoutRef.set({
            payoutId: payoutRef.id,
            partnerId: promoterId,
            amount: 500,
            status: 'completed',
            completedAt: new Date().toISOString(),
            requestedAt: new Date().toISOString(),
            paymentMethod: 'bank_transfer',
            createdAt: new Date().toISOString()
        });
    }

    console.log("Seeding complete!");
}

main().catch(console.error);
