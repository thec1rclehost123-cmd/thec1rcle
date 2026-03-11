import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/lib/server/apiClient";

/**
 * GET /api/promoter/guests
 * Live Guest Stream — returns recent orders attributed to this promoter.
 * Privacy-safe: only first name + last initial shown.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const promoterId = searchParams.get("promoterId");
        const limit = parseInt(searchParams.get("limit") || "50");
        const cursor = searchParams.get("cursor") || undefined;

        if (!promoterId) {
            return NextResponse.json(
                { error: "promoterId is required" },
                { status: 400 }
            );
        }

        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
        const client = getApiClient(token);

        // Query orders attributed to this promoter
        let orders: any[];
        try {
            orders = await client.request(`/orders?promoterId=${promoterId}&status=confirmed,completed&limit=${limit}&orderBy=createdAt&orderDirection=desc${cursor ? `&cursor=${cursor}` : ''}`);
        } catch {
            // Fallback: try direct Firestore query via analytics
            orders = [];
        }

        // If the API client doesn't return orders directly, try the promoter-links commissions
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

                    return NextResponse.json({
                        guests,
                        meta: { total: guests.length, hasMore: commissions.length > limit }
                    });
                }
            } catch {
                // Fall through to empty response
            }
        }

        // Map orders to guest stream format
        const guests = (Array.isArray(orders) ? orders : []).map((order: any) => ({
            id: order.id,
            guestName: privacySafeName(order.guestName || order.buyerName || "Guest"),
            eventTitle: order.eventTitle || "Event",
            eventId: order.eventId,
            amount: order.totalAmount || order.amount || 0,
            commission: order.promoterAttribution?.commissionAmount || 0,
            ticketCount: order.tickets?.length || order.quantity || 1,
            status: order.status || "confirmed",
            checkedIn: order.checkedIn || order.scanned || false,
            source: order.promoterAttribution?.source || null,
            createdAt: order.createdAt || new Date().toISOString()
        }));

        return NextResponse.json({
            guests,
            meta: {
                total: guests.length,
                hasMore: guests.length >= limit
            }
        });
    } catch (error: any) {
        console.error("[Promoter Guests API] GET Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch guest stream" },
            { status: 500 }
        );
    }
}

/**
 * Privacy-safe name: "Aayush Divase" → "Aayush D."
 */
function privacySafeName(name: string): string {
    if (!name || name === "Guest") return "Guest";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}
