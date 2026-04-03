import { NextRequest } from "next/server";
import { getApiClient } from "@/lib/server/apiClient";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";
import { logger } from "@/lib/server/logger";

function getTicketCount(order: Record<string, any>) {
    if (Array.isArray(order.tickets) && order.tickets.length > 0) {
        return order.tickets.reduce((sum, ticket) => sum + Number(ticket?.quantity || 1), 0);
    }
    return Number(order.quantity || 1);
}

/**
 * GET /api/promoter/guests
 * Live Guest Stream — returns recent orders attributed to this promoter.
 * Privacy-safe: only first name + last initial shown.
 */
export const GET = withAuth(async (req: NextRequest) => {
    try {
        const { searchParams } = new URL(req.url);
        const promoterId = searchParams.get("promoterId");
        const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
        const cursor = searchParams.get("cursor") || undefined;

        if (!promoterId) return fail("promoterId is required", 400);

        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
        const client = getApiClient(token);

        let orders: any[];
        try {
            orders = await client.request(`/orders?promoterId=${promoterId}&status=confirmed,completed&limit=${limit}&orderBy=createdAt&orderDirection=desc${cursor ? `&cursor=${cursor}` : ''}`);
        } catch {
            orders = [];
        }

        if (!orders || !Array.isArray(orders) || orders.length === 0) {
            try {
                const commissions = await client.request(`/promoter-links/commissions/${promoterId}`);
                if (Array.isArray(commissions)) {
                    const guests = commissions.slice(0, limit).map((comm: any) => ({
                        id: comm.id,
                        guestName: privacySafeName(comm.guestName || comm.buyerName || "Guest"),
                        eventTitle: comm.eventTitle || "Event",
                        eventId: comm.eventId,
                        amount: comm.orderAmount || comm.revenue || 0,
                        commission: comm.commissionAmount || comm.commission || 0,
                        ticketCount: comm.ticketCount || 1,
                        status: comm.status || "confirmed",
                        checkedIn: comm.checkedIn || false,
                        source: comm.source || null,
                        createdAt: comm.createdAt || new Date().toISOString()
                    }));

                    return ok({ guests, meta: { total: guests.length, hasMore: commissions.length > limit } });
                }
            } catch {
                // Fall through to empty response
            }
        }

        const guests = (Array.isArray(orders) ? orders : []).map((order: any) => ({
            id: order.id,
            guestName: privacySafeName(order.guestName || order.buyerName || "Guest"),
            eventTitle: order.eventTitle || "Event",
            eventId: order.eventId,
            amount: order.totalAmount || order.amount || 0,
            commission: order.promoterAttribution?.commissionAmount || 0,
            ticketCount: getTicketCount(order),
            status: order.status || "confirmed",
            checkedIn: order.checkedIn || order.scanned || false,
            source: order.promoterAttribution?.source || null,
            createdAt: order.createdAt || new Date().toISOString()
        }));

        return ok({ guests, meta: { total: guests.length, hasMore: guests.length >= limit } });
    } catch (error: any) {
        logger.error("promoter/guests", "Failed to fetch guest stream", { error: error.message });
        return fail("Failed to fetch guest stream");
    }
});

function privacySafeName(name: string): string {
    if (!name || name === "Guest") return "Guest";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}
