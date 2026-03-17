export interface UsageQuota {
    maxEvents: number;
    maxStudents?: number;
    rateLimit: number;
    features: string[];
}
export declare const PLAN_QUOTAS: Record<string, UsageQuota>;
export declare class BillingService {
    private db;
    constructor(db: FirebaseFirestore.Firestore);
    getWorkspaceUsage(workspaceId: string): Promise<Record<string, number>>;
    incrementUsage(workspaceId: string, metric: string, amount?: number): Promise<void>;
    checkQuota(workspaceId: string, plan: string, metric: string): Promise<boolean>;
}
