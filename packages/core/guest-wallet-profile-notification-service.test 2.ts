import { beforeEach, describe, expect, it, vi } from "vitest";

const cacheState = new Map();

vi.mock("./guest-profile-engine.js", () => ({
    findUserByEmail: vi.fn(),
    getUserEvents: vi.fn(async () => ({ upcoming: [], attended: [] })),
    getUserProfile: vi.fn(async () => ({ id: "user_1", displayName: "Guest" })),
    getUserTickets: vi.fn(async () => ({
        upcomingTickets: [{ ticketId: "ticket_1", orderId: "ord_1" }],
        pastTickets: [],
        actionNeeded: [],
        cancelledTickets: [],
    })),
    invalidateTicketsCache: vi.fn(async () => undefined),
}));

vi.mock("./guest-notification-engine.js", () => ({
    getUnreadCount: vi.fn(async () => 2),
    getUserNotifications: vi.fn(async () => []),
    markAllNotificationsRead: vi.fn(async () => ({ updated: 0 })),
    markNotificationRead: vi.fn(async () => ({ id: "notif_1", isRead: true })),
}));

vi.mock("@c1rcle/core/redis", () => ({
    cacheGet: vi.fn(async (key) => cacheState.get(key) ?? null),
    cacheSet: vi.fn(async (key, value) => {
        cacheState.set(key, value);
        return true;
    }),
    cacheDel: vi.fn(async (key) => {
        cacheState.delete(key);
        return true;
    }),
}));

import {
    findGuestWalletTicket,
    getGuestProfileSummary,
    getGuestWallet,
    invalidateGuestWallet,
    markAllGuestNotificationsRead,
    markGuestNotificationRead,
} from "./guest-wallet-profile-notification-service.js";
import { getUserEvents, getUserProfile, getUserTickets } from "./guest-profile-engine.js";

describe("guest-wallet-profile-notification-service", () => {
    beforeEach(() => {
        cacheState.clear();
        vi.clearAllMocks();
    });

    it("findGuestWalletTicket searches all legacy wallet buckets", () => {
        const wallet = {
            upcomingTickets: [],
            pastTickets: [{ ticketId: "past_1" }],
            actionNeeded: [{ id: "transfer_1", type: "transfer" }],
            cancelledTickets: [{ ticketId: "cancelled_1" }],
        };

        expect(findGuestWalletTicket(wallet, "past_1")).toEqual({ ticketId: "past_1" });
        expect(findGuestWalletTicket(wallet, "transfer_1")).toEqual({ id: "transfer_1", type: "transfer" });
        expect(findGuestWalletTicket(wallet, "missing")).toBeNull();
    });

    it("getGuestWallet groups cover wallets by order id when a db handle is provided", async () => {
        const coverWalletCollection = {
            where: vi.fn(() => ({
                get: vi.fn(async () => ({
                    docs: [{
                        id: "wallet_1",
                        data: () => ({
                            orderId: "ord_1",
                            state: "ACTIVE",
                            openingBalancePaise: 5000,
                            currentBalancePaise: 3200,
                            totalDebitedPaise: 1800,
                            rules: {
                                terminationTime: "2099-01-01T02:00:00.000Z",
                                showBalanceToGuest: true,
                                showTransactionHistory: true,
                            },
                        }),
                    }],
                })),
            })),
        };
        const db = {
            collection: vi.fn((name) => {
                if (name === "cover_wallets") return coverWalletCollection;
                throw new Error(`Unexpected collection: ${name}`);
            }),
        } as any;

        const wallet = await getGuestWallet(db, null, "user_1");

        expect(wallet.coverWalletsByOrder).toEqual({
            ord_1: [{
                id: "wallet_1",
                orderId: "ord_1",
                state: "ACTIVE",
                openingBalancePaise: 5000,
                currentBalancePaise: 3200,
                totalDebitedPaise: 1800,
                terminationTime: "2099-01-01T02:00:00.000Z",
                eventId: null,
                rules: {
                    terminationTime: "2099-01-01T02:00:00.000Z",
                    showBalanceToGuest: true,
                    showTransactionHistory: true,
                },
            }],
        });
    });

    it("passes the viewer id into getUserProfile so owner summaries are not ghosted", async () => {
        const mockedGetUserProfile = vi.mocked(getUserProfile);
        mockedGetUserProfile.mockResolvedValueOnce({
            id: "user_1",
            uid: "user_1",
            displayName: "Aayush Divase",
            email: "aayush@example.com",
            photoURL: "https://cdn.example.com/profile.jpg",
            avatar: "https://cdn.example.com/profile.jpg",
            city: "Pune",
            gender: "male",
            hostStatus: "approved",
            createdAt: "2026-04-13T21:41:31.615Z",
        } as any);

        const summary = await getGuestProfileSummary("user_1", "user_1");

        expect(mockedGetUserProfile).toHaveBeenCalledWith("user_1", "user_1");
        expect(summary.profile).toMatchObject({
            displayName: "Aayush Divase",
            email: "aayush@example.com",
            photoURL: "https://cdn.example.com/profile.jpg",
            avatar: "https://cdn.example.com/profile.jpg",
        });
    });

    it("reuses the cached guest wallet before rebuilding tickets and notifications", async () => {
        await getGuestWallet("user_1");
        await getGuestWallet("user_1");

        expect(vi.mocked(getUserTickets)).toHaveBeenCalledTimes(1);
    });

    it("reuses cached profile event summaries for repeated reads of the same viewer scope", async () => {
        await getGuestProfileSummary("user_1", "user_1");
        await getGuestProfileSummary("user_1", "user_1");

        expect(vi.mocked(getUserEvents)).toHaveBeenCalledTimes(1);
    });

    it("invalidates both the guest wallet aggregate cache and ticket cache", async () => {
        await getGuestWallet("user_1");
        await invalidateGuestWallet(["user_1"]);
        await getGuestWallet("user_1");

        expect(vi.mocked(getUserTickets)).toHaveBeenCalledTimes(2);
    });

    it("markGuestNotificationRead enforces notification ownership", async () => {
        const update = vi.fn(async () => undefined);
        const db = {
            collection: vi.fn(() => ({
                doc: vi.fn(() => ({
                    get: vi.fn(async () => ({
                        exists: true,
                        data: () => ({ userId: "other_user" }),
                    })),
                    update,
                })),
            })),
        } as any;

        await expect(markGuestNotificationRead(db, "user_1", "notif_1")).rejects.toThrow("Unauthorized");
        expect(update).not.toHaveBeenCalled();
    });

    it("markAllGuestNotificationsRead updates every unread notification and returns the count", async () => {
        const update = vi.fn();
        const batch = {
            update,
            commit: vi.fn(async () => undefined),
        };
        const docs = [
            { ref: { id: "notif_1" } },
            { ref: { id: "notif_2" } },
        ];
        const db = {
            batch: vi.fn(() => batch),
            collection: vi.fn(() => ({
                where: vi.fn(() => ({
                    where: vi.fn(() => ({
                        get: vi.fn(async () => ({
                            size: docs.length,
                            docs,
                        })),
                    })),
                })),
            })),
        } as any;

        const result = await markAllGuestNotificationsRead(db, "user_1");

        expect(result).toEqual({ updated: 2 });
        expect(update).toHaveBeenCalledTimes(2);
        expect(batch.commit).toHaveBeenCalledTimes(1);
    });
});
