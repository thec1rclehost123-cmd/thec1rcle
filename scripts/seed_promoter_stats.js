const admin = require("firebase-admin");

if (!admin.apps.length) {
    const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!serviceAccount) {
        console.warn("No GOOGLE_APPLICATION_CREDENTIALS found. Running default admin initialization.");
        admin.initializeApp();
    } else {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }
}

const db = admin.firestore();

async function run() {
    console.log("Starting promoter stats backfill script...");
    
    // Process orders in batches to avoid memory overflow
    let lastDoc = null;
    let totalProcessed = 0;
    const promoterStats = new Map(); // promoterId -> { totalOrders, totalRevenue, totalCommission }

    while (true) {
        let query = db.collection("orders")
            .where("status", "in", ["confirmed", "completed"])
            .orderBy("__name__")
            .limit(500);
            
        if (lastDoc) {
            query = query.startAfter(lastDoc);
        }

        const snapshot = await query.get();
        if (snapshot.empty) break;

        snapshot.forEach(doc => {
            const data = doc.data();
            const promoterId = data.promoterId;
            if (!promoterId) return;

            if (!promoterStats.has(promoterId)) {
                promoterStats.set(promoterId, { totalOrders: 0, totalRevenue: 0, totalCommission: 0 });
            }

            const stats = promoterStats.get(promoterId);
            stats.totalOrders += 1;
            stats.totalRevenue += (data.totalAmount || 0);
            stats.totalCommission += (data.promoterAttribution?.commissionAmount || 0);
            
            promoterStats.set(promoterId, stats);
        });

        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        totalProcessed += snapshot.size;
        console.log(`Processed ${totalProcessed} orders...`);
    }

    console.log(`Finished aggregating. Found stats for ${promoterStats.size} promoters. Committing to Firestore...`);

    let batch = db.batch();
    let batchCount = 0;

    for (const [promoterId, stats] of promoterStats.entries()) {
        const ref = db.collection("promoter_stats").doc(promoterId);
        batch.set(ref, {
            totalOrders: stats.totalOrders,
            totalRevenue: stats.totalRevenue,
            totalCommission: stats.totalCommission,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        batchCount++;
        if (batchCount === 500) {
            await batch.commit();
            console.log(`Committed 500 promoter stats...`);
            batch = db.batch();
            batchCount = 0;
        }
    }

    if (batchCount > 0) {
        await batch.commit();
        console.log(`Committed remaining ${batchCount} promoter stats.`);
    }

    console.log("Backfill complete!");
    process.exit(0);
}

run().catch(console.error);
