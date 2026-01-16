import { getAdminDb } from "../firebase/admin";

/**
 * THE C1RCLE - Sponsored Notification & Push Campaigns
 * Logic for audience targeting, frequency capping, and campaign management.
 */

export const campaignStore = {
    /**
     * Create a new push campaign.
     */
    async createCampaign(campaignData, adminId) {
        const db = getAdminDb();

        const campaign = {
            ...campaignData,
            status: 'pending', // pending -> approved -> active -> completed
            adminId,
            createdAt: new Date(),
            metrics: {
                sentCount: 0,
                clickCount: 0,
                conversionCount: 0
            }
        };

        const docRef = await db.collection('notification_campaigns').add(campaign);

        await db.collection('admin_logs').add({
            adminId,
            action: 'CAMPAIGN_CREATE',
            targetId: docRef.id,
            timestamp: new Date()
        });

        return docRef.id;
    },

    /**
     * Approve and schedule a campaign.
     */
    async approveCampaign(campaignId, scheduleTime, adminId) {
        const db = getAdminDb();

        await db.collection('notification_campaigns').doc(campaignId).update({
            status: 'approved',
            scheduledAt: new Date(scheduleTime),
            approvedBy: adminId,
            updatedAt: new Date()
        });
    },

    /**
     * Target audience logic (Internal Mock).
     * In a real implementation, this would query users based on 'city', 'tags', 'interests'.
     */
    async getTargetAudience(criteria) {
        const db = getAdminDb();
        let query = db.collection('users');

        if (criteria.city) {
            query = query.where('city', '==', criteria.city);
        }

        if (criteria.lastActiveDays) {
            const dateLimit = new Date();
            dateLimit.setDate(dateLimit.getDate() - criteria.lastActiveDays);
            query = query.where('lastActive', '>=', dateLimit);
        }

        const snapshot = await query.get();
        return snapshot.docs.map(doc => doc.id);
    }
};
