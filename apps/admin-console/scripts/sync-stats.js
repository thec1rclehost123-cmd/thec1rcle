
const admin = require('firebase-admin');

// Adjust this path if you have a service account key, 
// otherwise it will use default credentials (ADC) or emulator.
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'thec1rcle-india'
    });
}

const db = admin.firestore();

async function syncPlatformStats() {
    console.log("Starting platform stats synchronization...");

    try {
        // 1. Count Users
        const usersSnapshot = await db.collection('users').count().get();
        const usersTotal = usersSnapshot.data().count;
        console.log(`- Detected ${usersTotal} users.`);

        // 2. Count Venues by status
        const venuesActive = await db.collection('venues').where('status', '==', 'active').count().get();
        const venuesPending = await db.collection('venues').where('status', '==', 'pending').count().get();
        const venuesSuspended = await db.collection('venues').where('status', '==', 'suspended').count().get();

        const venuesTotal = {
            active: venuesActive.data().count,
            pending: venuesPending.data().count,
            suspended: venuesSuspended.data().count
        };
        console.log(`- Detected venues: ${JSON.stringify(venuesTotal)}`);

        // 3. Count Hosts
        const hostsSnapshot = await db.collection('hosts').count().get();
        const hostsTotal = hostsSnapshot.data().count;
        // Optionally count pending host applications
        const hostAppsPending = await db.collection('onboarding_requests').where('type', '==', 'host').where('status', '==', 'pending').count().get();

        const hostStats = {
            total: hostsTotal,
            pending: hostAppsPending.data().count
        };
        console.log(`- Detected hosts: ${JSON.stringify(hostStats)}`);

        // 4. Events Total
        const eventsSnapshot = await db.collection('events').count().get();
        const eventsTotal = eventsSnapshot.data().count;
        console.log(`- Detected ${eventsTotal} total events.`);

        // 5. Update platform_stats/current
        await db.collection('platform_stats').doc('current').set({
            users_total: usersTotal,
            venues_total: venuesTotal,
            hosts_total: hostsTotal, // Using the simple count for the dashboard stat
            events_total: eventsTotal,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log("✅ Platform stats synchronized successfully.");

    } catch (error) {
        console.error("❌ Synchronization failed:", error);
    }
}

syncPlatformStats();
