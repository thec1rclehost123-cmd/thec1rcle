import { Firestore, Transaction } from 'firebase-admin/firestore';

export interface IdempotencyRecord {
    key: string;
    userId: string;
    responseBody: any;
    statusCode: number;
    expiresAt: Date;
}

/**
 * Idempotency Service
 * 
 * Ensures that critical operations (payments, orders, cancellations)
 * are only executed once per unique Idempotency-Key.
 */
export class IdempotencyService {
    private readonly COLLECTION = 'idempotency_keys';
    private readonly DEFAULT_TTL_HOURS = 24;

    constructor(private db: Firestore) {}

    /**
     * Attempts to retrieve a cached response for an idempotency key.
     * Returns null if no record exists or if it has expired.
     */
    async getCachedResponse(key: string, userId: string): Promise<{ body: any, status: number } | null> {
        const doc = await this.db.collection(this.COLLECTION).doc(this.buildDocId(key, userId)).get();
        if (!doc.exists) return null;

        const data = doc.data() as IdempotencyRecord;
        if (new Date() > new Date(data.expiresAt)) {
            await doc.ref.delete().catch(() => {});
            return null;
        }

        return { body: data.responseBody, status: data.statusCode };
    }

    /**
     * Saves a response to the idempotency store.
     */
    async saveResponse(key: string, userId: string, responseBody: any, statusCode: number, ttlHours = this.DEFAULT_TTL_HOURS): Promise<void> {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + ttlHours);

        await this.db.collection(this.COLLECTION).doc(this.buildDocId(key, userId)).set({
            key,
            userId,
            responseBody,
            statusCode,
            expiresAt,
            createdAt: new Date()
        });
    }

    /**
     * Executes a callback within a lock for idempotency.
     * Use this for atomic check-and-set operations.
     */
    async executeOnce<T>(
        key: string, 
        userId: string, 
        work: (transaction: Transaction) => Promise<T>
    ): Promise<T | { cached: true, body: any, status: number }> {
        const docId = this.buildDocId(key, userId);
        
        return await this.db.runTransaction(async (transaction) => {
            const doc = await transaction.get(this.db.collection(this.COLLECTION).doc(docId));
            
            if (doc.exists) {
                const data = doc.data() as IdempotencyRecord;
                if (new Date() <= new Date(data.expiresAt)) {
                    return { cached: true, body: data.responseBody, status: data.statusCode };
                }
            }

            const result = await work(transaction);
            
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + this.DEFAULT_TTL_HOURS);

            transaction.set(this.db.collection(this.COLLECTION).doc(docId), {
                key,
                userId,
                responseBody: result,
                statusCode: 200, // Default success
                expiresAt,
                createdAt: new Date()
            });

            return result;
        });
    }

    private buildDocId(key: string, userId: string): string {
        // Namespace by userId to prevent key collisions between different users
        return `${userId}:${key}`;
    }
}
