export interface UsageQuota {
    maxEvents: number;
    maxStudents?: number;
    rateLimit: number;
    features: string[];
}

export const PLAN_QUOTAS: Record<string, UsageQuota> = {
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
    constructor(private db: FirebaseFirestore.Firestore) { }

    async getWorkspaceUsage(workspaceId: string): Promise<Record<string, number>> {
        const stats = await this.db.collection('workspaces').doc(workspaceId).collection('usage').doc('current').get();
        return stats.exists ? stats.data() as any : { eventsCreated: 0, apiCalls: 0 };
    }

    async incrementUsage(workspaceId: string, metric: string, amount: number = 1): Promise<void> {
        const ref = this.db.collection('workspaces').doc(workspaceId).collection('usage').doc('current');
        await ref.set({
            [metric]: FirebaseFirestore.FieldValue.increment(amount),
            updatedAt: new Date().toISOString()
        }, { merge: true });
    }

    async checkQuota(workspaceId: string, plan: string, metric: string): Promise<boolean> {
        const quota = PLAN_QUOTAS[plan];
        if (!quota) return false;

        const usage = await this.getWorkspaceUsage(workspaceId);
        const currentUsage = usage[metric] || 0;
        const max = (quota as any)[metric];

        if (max === undefined) return true; // No quota defined for this metric
        return currentUsage < max;
    }
}
