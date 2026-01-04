import { getAdminDb } from "../firebase/admin";

/**
 * THE C1RCLE - Discovery Algorithm & Discovery Engine
 * Governs visibility, priority, and manual overrides.
 */

export const discoveryEngine = {
    /**
     * Calculate discovery weight based on organic signals and paid boosts.
     */
    async calculateEventWeight(eventData) {
        let weight = 0;

        // 1. Organic Signals
        weight += (eventData.ticketSalesCount || 0) * 10;
        weight += (eventData.viewerCount || 0) * 1;
        weight += (eventData.followerCount || 0) * 5;

        // 2. Paid Boosts (Admin controlled)
        if (eventData.isBoosted) {
            weight += (eventData.boostIntensity || 500);
        }

        // 3. Admin Overrides (Manual Curation)
        if (eventData.adminWeightOverride) {
            weight = eventData.adminWeightOverride;
        }

        // 4. Throttling (Anti-Spam / Overexposure)
        if (eventData.isThrottled) {
            weight *= 0.2; // 80% reduction in visibility
        }

        // 5. Time Proximity (Urgency)
        const hoursToStart = (eventData.startTime.toDate() - new Date()) / (1000 * 60 * 60);
        if (hoursToStart > 0 && hoursToStart < 24) {
            weight += 200; // Boost events happening in the next 24 hours
        }

        return weight;
    },

    /**
     * Admin: Manual override for discovery weight.
     */
    async setManualOverride(eventId, weight, adminId, reason) {
        const db = getAdminDb();
        await db.collection('events').doc(eventId).update({
            adminWeightOverride: weight,
            adminOverrideReason: reason,
            updatedAt: new Date()
        });

        await db.collection('admin_logs').add({
            adminId,
            action: 'DISCOVERY_OVERRIDE',
            targetId: eventId,
            timestamp: new Date(),
            metadata: { newWeight: weight, reason }
        });
    },

    /**
     * Admin: Throttle overexposed content.
     */
    async throttleContent(targetId, targetType, isThrottled, adminId, reason) {
        const db = getAdminDb();
        const collection = targetType === 'event' ? 'events' : 'venues';

        await db.collection(collection).doc(targetId).update({
            isThrottled,
            throttledAt: isThrottled ? new Date() : null,
            throttleReason: reason
        });

        await db.collection('admin_logs').add({
            adminId,
            action: isThrottled ? 'THROTTLE_ON' : 'THROTTLE_OFF',
            targetId,
            timestamp: new Date(),
            reason
        });
    }
};
