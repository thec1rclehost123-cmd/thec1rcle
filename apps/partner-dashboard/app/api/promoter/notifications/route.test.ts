import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePromoterAccessMock = vi.fn();
const getAdminDbMock = vi.fn();

vi.mock("@/lib/server/promoterAuthMiddleware", () => ({
    requirePromoterAccess: requirePromoterAccessMock,
}));

vi.mock("@/lib/firebase/admin", () => ({
    getAdminDb: getAdminDbMock,
}));

vi.mock("@/lib/server/apiResponse", () => ({
    ok: (data: any, message = "", status = 200) =>
        Response.json({ success: true, ...data, message }, { status }),
    fail: (message: string, status = 500) =>
        Response.json({ success: false, error: message }, { status }),
}));

function makeSnapshot(docs: any[]) {
    return {
        docs,
        empty: docs.length === 0,
        size: docs.length,
    };
}

function makeDoc(id: string, data: Record<string, any>) {
    return {
        id,
        data: () => data,
        ref: { id },
    };
}

function makeDb(fixtures: Record<string, any[]>) {
    const batchUpdates: any[] = [];
    const batch = {
        update: vi.fn((ref, payload) => {
            batchUpdates.push({ ref, payload });
        }),
        commit: vi.fn().mockResolvedValue(undefined),
    };

    return {
        collection: vi.fn((name: string) => {
            const docs = fixtures[name] || [];
            return {
                where: vi.fn(() => ({
                    where: vi.fn(() => ({
                        get: vi.fn().mockResolvedValue(makeSnapshot(docs)),
                    })),
                    limit: vi.fn(() => ({
                        get: vi.fn().mockResolvedValue(makeSnapshot(docs)),
                    })),
                    get: vi.fn().mockResolvedValue(makeSnapshot(docs)),
                })),
                limit: vi.fn(() => ({
                    get: vi.fn().mockResolvedValue(makeSnapshot(docs)),
                })),
            };
        }),
        batch: vi.fn(() => batch),
        __batchUpdates: batchUpdates,
        __batch: batch,
    };
}

describe("/api/promoter/notifications", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        requirePromoterAccessMock.mockResolvedValue({
            uid: "user_1",
            promoterId: "promoter_1",
            role: "PROMOTER",
            displayName: "Promoter One",
        });
    });

    it("aggregates promoter notifications from connections, commissions, payouts, and direct notifications", async () => {
        const db = makeDb({
            promoter_connections: [
                makeDoc("conn_1", {
                    promoterId: "promoter_1",
                    targetName: "Club One",
                    targetType: "venue",
                    status: "approved",
                    updatedAt: "2026-04-02T10:00:00.000Z",
                }),
            ],
            promoter_commissions: [
                makeDoc("comm_1", {
                    promoterId: "promoter_1",
                    eventName: "Friday Night",
                    commissionAmount: 2500,
                    status: "cleared",
                    createdAt: "2026-04-02T09:00:00.000Z",
                }),
            ],
            payouts: [
                makeDoc("pay_1", {
                    partnerId: "promoter_1",
                    amount: 1800,
                    status: "pending",
                    createdAt: "2026-04-02T08:00:00.000Z",
                }),
            ],
            notifications: [
                makeDoc("direct_1", {
                    recipientPartnerId: "promoter_1",
                    title: "Manual notice",
                    message: "Check your account",
                    createdAt: "2026-04-02T11:00:00.000Z",
                }),
            ],
        });
        getAdminDbMock.mockReturnValue(db);

        const { GET } = await import("./route");
        const response = await GET(new Request("http://localhost/api/promoter/notifications?limit=10") as any);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.notifications).toHaveLength(4);
        expect(payload.unreadCount).toBe(4);
        expect(payload.notifications[0].id).toBe("direct_1");
        expect(payload.notifications.map((entry: any) => entry.type)).toEqual(
            expect.arrayContaining(["promoter_request", "revenue", "payment"])
        );
    });

    it("marks promoter notifications as read across all backing collections", async () => {
        const db = makeDb({
            promoter_connections: [makeDoc("conn_1", { promoterId: "promoter_1" })],
            promoter_commissions: [makeDoc("comm_1", { promoterId: "promoter_1" })],
            payouts: [makeDoc("pay_1", { partnerId: "promoter_1" })],
            notifications: [makeDoc("direct_1", { recipientPartnerId: "promoter_1", read: false })],
        });
        getAdminDbMock.mockReturnValue(db);

        const { PATCH } = await import("./route");
        const response = await PATCH({
            json: vi.fn().mockResolvedValue({ markAll: true }),
        } as any);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.marked).toBe(5);
        expect(db.__batch.commit).toHaveBeenCalledTimes(5);
    });
});
