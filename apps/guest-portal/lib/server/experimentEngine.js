import { getAdminDb } from "../firebase/admin";

/**
 * THE C1RCLE - Experiment Engine (A/B Testing)
 * Governs platform experiments, feature flags, and pricing tests.
 */

export const experimentEngine = {
    /**
     * Define an experiment.
     */
    async createExperiment(config, adminId) {
        const db = getAdminDb();
        const experiment = {
            ...config,
            status: 'draft', // draft -> active -> paused -> archived
            createdAt: new Date(),
            adminId,
            results: {}
        };

        const docRef = await db.collection('platform_experiments').add(experiment);
        return docRef.id;
    },

    /**
     * Toggle feature flags globally.
     */
    async setFeatureFlag(flagName, value, adminId, reason) {
        const db = getAdminDb();
        await db.collection('platform_settings').doc('feature_flags').set({
            [flagName]: value,
            updatedBy: adminId,
            updatedAt: new Date(),
            lastReason: reason
        }, { merge: true });

        await db.collection('admin_logs').add({
            adminId,
            action: `FLAG_${flagName.toUpperCase()}_${value.toString().toUpperCase()}`,
            timestamp: new Date(),
            reason
        });
    },

    /**
     * Get dynamic pricing or weightage models.
     */
    async getPlatformParameters() {
        const db = getAdminDb();
        const settings = await db.collection('platform_settings').doc('global').get();
        return settings.exists ? settings.data() : {
            commissionRate: 0.15,
            boostBasePrice: 500,
            featuredSlotWeekly: 2000
        };
    }
};
