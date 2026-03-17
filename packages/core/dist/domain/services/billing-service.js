export const PLAN_QUOTAS = {
    basic: {
        maxEvents: 50,
        rateLimit: 150,
        features: ['analytics']
    },
    pro: {
        maxEvents: 500,
        maxStudents: 1000,
        rateLimit: 1000,
        features: ['analytics', 'staff', 'orders', 'inventory']
    },
    enterprise: {
        maxEvents: 10000,
        maxStudents: 50000,
        rateLimit: 5000,
        features: ['analytics', 'staff', 'orders', 'inventory', 'advanced_reports', 'api_access']
    }
};
export class BillingService {
    db;
    constructor(db) {
        this.db = db;
    }
    async getWorkspaceUsage(workspaceId) {
        const stats = await this.db.collection('workspaces').doc(workspaceId).collection('usage').doc('current').get();
        return stats.exists ? stats.data() : { eventsCreated: 0, apiCalls: 0 };
    }
    async incrementUsage(workspaceId, metric, amount = 1) {
        const ref = this.db.collection('workspaces').doc(workspaceId).collection('usage').doc('current');
        await ref.set({
            [metric]: FirebaseFirestore.FieldValue.increment(amount),
            updatedAt: new Date().toISOString()
        }, { merge: true });
    }
    async checkQuota(workspaceId, plan, metric) {
        const quota = PLAN_QUOTAS[plan];
        if (!quota)
            return false;
        const usage = await this.getWorkspaceUsage(workspaceId);
        const currentUsage = usage[metric] || 0;
        const max = quota[metric];
        if (max === undefined)
            return true; // No quota defined for this metric
        return currentUsage < max;
    }
}
