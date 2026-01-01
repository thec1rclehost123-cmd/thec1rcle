const admin = require("firebase-admin");
const path = require("path");

const serviceAccountPath = path.resolve(__dirname, "../../Downloads/thec1rcle-india-firebase-adminsdk-fbsvc-7a42d7c601.json");
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function runSeeder() {
    try {
        // 1. Global Settings
        await db.collection('platform_settings').doc('global').set({
            commissionRate: 0.15,
            boostBasePrice: 500,
            featuredSlotWeekly: 2000,
            minWithdrawal: 1000,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // 2. Feature Flags
        await db.collection('platform_settings').doc('feature_flags').set({
            enableTicketTransfers: true,
            enablePublicDiscovery: true,
            enableHostApplications: true,
            maintenanceMode: false,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // 3. Initial Stats
        const statsRef = db.collection('platform_stats').doc('current');
        const statsDoc = await statsRef.get();
        if (!statsDoc.exists) {
            await statsRef.set({
                users_total: 0,
                venues_total: { active: 0, pending: 0, suspended: 0 },
                revenue: { total: 0, ticket_commissions: 0, boosts: 0, subscriptions: 0 },
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        console.log("Database seeded successfully with default governance rules.");
    } catch (e) {
        console.error(`Seeding failed: ${e.message}`);
    }
}

runSeeder();
