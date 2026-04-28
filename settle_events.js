/**
 * THE C1RCLE - Settlement Tool
 * This script demonstrates the automated settlement of events using the Ledger Engine.
 */

import { settleEvent } from "./packages/core/payout-engine.js";
import { getAdminDb } from "./packages/core/admin.js";

async function runSettlement() {
    console.log("🚀 Starting Global Settlement Audit...");

    const db = getAdminDb();

    // Find all completed events that haven't been settled yet
    // In a real system, we might have a 'settled' flag or just let the engine be idempotent
    const eventsSnapshot = await db.collection("events")
        .where("lifecycle", "==", "completed")
        .get();

    if (eventsSnapshot.empty) {
        console.log("✅ All completed events are already settled or no events found.");
        return;
    }

    for (const eventDoc of eventsSnapshot.docs) {
        const eventId = eventDoc.id;
        const title = eventDoc.data().title;

        console.log(`\n📦 Processing Settlement for: ${title} (${eventId})`);

        try {
            const result = await settleEvent(eventId);
            console.log(`   ✅ Success: Processed ${result.processedCount} of ${result.totalOrders} total orders.`);
        } catch (err) {
            console.error(`   ❌ Failed to settle event ${eventId}:`, err.message);
        }
    }

    console.log("\n🏁 Settlement Audit Completed.");
}

import { withLock } from "./packages/core/lock-service.js";

// In polyfill environment (Node)
withLock("settle-events", runSettlement).catch(err => {
    console.error("❌ " + err.message);
    process.exit(1);
});
