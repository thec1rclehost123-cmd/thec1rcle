import { getAdminDb } from "../firebase/admin";

/**
 * THE C1RCLE - Platform Seeding
 * Initializes global settings and stats.
 */

export async function seedPlatformSettings() {
    const db = getAdminDb();

    // 1. Global Settings
    const settingsRef = db.collection('platform_settings').doc('global');
    await settingsRef.set({
        commissionRate: 0.15, // 15%
        boostBasePrice: 500,
        featuredSlotWeekly: 2000,
        minWithdrawal: 1000,
        updatedAt: new Date()
    }, { merge: true });

    // 2. Feature Flags
    const flagsRef = db.collection('platform_settings').doc('feature_flags');
    await flagsRef.set({
        enableTicketTransfers: true,
        enablePublicDiscovery: true,
        enableHostApplications: true,
        maintenanceMode: false,
        updatedAt: new Date()
    }, { merge: true });

    // 3. Initial Stats
    const statsRef = db.collection('platform_stats').doc('current');
    const statsDoc = await statsRef.get();
    if (!statsDoc.exists) {
        await statsRef.set({
            users_total: 0,
            venues_total: { active: 0, pending: 0, suspended: 0 },
            revenue: { total: 0, ticket_commissions: 0, boosts: 0, subscriptions: 0 },
            updatedAt: new Date()
        });
    }

    console.log("Platform settings and stats seeded successfully.");
}
