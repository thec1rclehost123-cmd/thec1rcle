const admin = require('firebase-admin');

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

admin.initializeApp({
    projectId: 'thec1rcle-india'
});

const db = admin.firestore();

async function seed() {
    // If we're not running the emulator, this might fail without credentials
    // If there is an emulator, uncomment the host line
    
    // We will just seed it using the local dev environment or production based on GOOGLE_APPLICATION_CREDENTIALS
    // Let's first try to get users
    console.log("Fetching users...");
    let uids = [];
    try {
        const usersSnapshot = await admin.auth().listUsers(100);
        uids = usersSnapshot.users
            .filter(u => u.email && u.email.includes('aayush'))
            .map(u => u.uid);
            
        if (uids.length === 0) {
            uids = usersSnapshot.users.slice(0,3).map(u => u.uid);
        }
    } catch (e) {
        console.log("Could not fetch auth users, falling back to writing to common UIDs");
        uids = ["qrRuVUsRkCaHE5fETbQST6hiKx12", "qB0dVjq55HdMjQ1HotcBDbwsXK62"];
    }

    console.log('Seeding tickets for users:', uids);

    const now = new Date();
    const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    const pastDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

    for (const uid of uids) {
        // Upcoming Ticket
        await db.collection('orders').doc(`upcoming-${uid}`).set({
            userId: uid,
            eventId: 'mock-event-1',
            eventTitle: 'After Dark AZ: Mansion Party',
            eventDate: futureDate.toISOString(),
            eventCoverImage: 'https://images.unsplash.com/photo-1574169208507-84376144848b?q=80&w=1000&auto=format&fit=crop',
            hostName: 'AAYUSH DIVASE',
            status: 'confirmed',
            totalAmount: 1500,
            currency: 'INR',
            createdAt: now.toISOString(),
            tickets: [
                {
                    tierName: 'General Entry',
                    quantity: 1,
                    price: 1500
                }
            ],
            totalGuests: 1
        });

        // Past Ticket
        await db.collection('orders').doc(`past-${uid}`).set({
            userId: uid,
            eventId: 'mock-event-2',
            eventTitle: 'Yugant Bday',
            eventDate: pastDate.toISOString(),
            eventCoverImage: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1000&auto=format&fit=crop',
            hostName: 'AAYUSH DIVASE',
            status: 'checked_in',
            totalAmount: 0,
            currency: 'INR',
            createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
            tickets: [
                {
                    tierName: 'VIP',
                    quantity: 2,
                    price: 0
                }
            ],
            totalGuests: 2
        });
    }

    console.log('Seeding complete!');
}

seed().catch(console.error);
