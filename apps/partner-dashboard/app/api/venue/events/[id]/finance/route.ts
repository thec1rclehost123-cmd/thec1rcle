/**
 * GET /api/venue/events/[id]/finance
 * Venue-scoped event revenue and payout summary used by the venue event workspace.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { getAdminDb } from "@/lib/firebase/admin";
import { listPromoterLinks } from "@/lib/server/promoterLinkStore";

type PartnerSettlementRecord = {
    partnerId?: string;
    partnerName?: string;
    status?: string;
    settledAt?: string | null;
    holdReason?: string | null;
};

function toNumber(value: any) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeLabel(value: string, fallback: string) {
    return String(value || fallback)
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function toPaise(amount: number) {
    return Math.round(amount * 100);
}

function isPartnerHostedEvent(event: Record<string, any>) {
    const creatorRole = String(event.creatorRole || event.eventType || "").toLowerCase();
    return creatorRole === "host";
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await requireVenueAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const { venueId } = ctx as any;
    const db = getAdminDb();

    try {
        const eventDoc = await db.collection("events").doc(id).get();
        if (!eventDoc.exists) {
            return NextResponse.json({ error: "Event not found" }, { status: 404 });
        }

        const event = eventDoc.data()!;
        if (event.venueId !== venueId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (isPartnerHostedEvent(event)) {
            return NextResponse.json({ error: "Revenue is hidden for host-managed events" }, { status: 403 });
        }

        const [completedSnap, refundedSnap, hostDoc, hostEarningsSnap, settlementsSnap, promoterAssignmentsSnap] = await Promise.all([
            db.collection("orders")
                .where("eventId", "==", id)
                .where("status", "in", ["completed", "confirmed", "checked_in"])
                .get(),
            db.collection("orders")
                .where("eventId", "==", id)
                .where("status", "==", "refunded")
                .get(),
            event.hostId ? db.collection("hosts").doc(String(event.hostId)).get() : Promise.resolve(null),
            event.hostId
                ? db.collection("host_earnings")
                    .where("eventId", "==", id)
                    .where("hostId", "==", String(event.hostId))
                    .limit(1)
                    .get()
                : Promise.resolve(null),
            db.collection("partner_settlements")
                .where("eventId", "==", id)
                .get(),
            db.collection("promoter_assignments")
                .where("eventId", "==", id)
                .get(),
        ]);

        let gross = 0;
        let refunds = 0;
        let walkInRevenue = 0;
        let walkInOrders = 0;
        let onlineOrders = 0;
        let onlineRevenue = 0;

        const paymentSources = new Map<string, { label: string; amount: number; orders: number }>();
        const intakeChannels = new Map<string, { label: string; amount: number; orders: number }>();
        const ticketMix = new Map<string, { tierId: string; tierName: string; revenue: number; sold: number }>();

        for (const doc of completedSnap.docs) {
            const order = doc.data();
            const quantity = toNumber(order.quantity || 1);
            const total = toNumber(order.totalAmount || order.amount || 0);

            gross += total;

            const intakeRaw = String(order.channel || order.source || order.saleSource || "").toLowerCase();
            const isWalkIn = Boolean(order.walkIn || order.isWalkIn || intakeRaw.includes("walk"));
            if (isWalkIn) {
                walkInRevenue += total;
                walkInOrders += 1;
            } else {
                onlineRevenue += total;
                onlineOrders += 1;
            }

            const paymentKey = String(order.paymentMethod || order.paymentProvider || order.gateway || "online").toLowerCase();
            const paymentLabel = normalizeLabel(paymentKey, "Online");
            const payment = paymentSources.get(paymentKey) || { label: paymentLabel, amount: 0, orders: 0 };
            payment.amount += total;
            payment.orders += 1;
            paymentSources.set(paymentKey, payment);

            const intakeKey = isWalkIn ? "walk_in" : (intakeRaw || "online");
            const intakeLabel = normalizeLabel(intakeKey, isWalkIn ? "Walk In" : "Online");
            const channel = intakeChannels.get(intakeKey) || { label: intakeLabel, amount: 0, orders: 0 };
            channel.amount += total;
            channel.orders += 1;
            intakeChannels.set(intakeKey, channel);

            const tierId = String(order.tierId || order.ticketTierId || order.tierName || "general");
            const tierName = String(order.tierName || order.ticketTypeName || order.tierLabel || "General Admission");
            const tier = ticketMix.get(tierId) || { tierId, tierName, revenue: 0, sold: 0 };
            tier.revenue += total;
            tier.sold += quantity;
            ticketMix.set(tierId, tier);
        }

        for (const doc of refundedSnap.docs) {
            const order = doc.data();
            refunds += toNumber(order.totalAmount || order.amount || 0);
        }

        const platformFee = Math.round(gross * 0.1);
        const venueCommissionRate = toNumber(event.venueCommissionRate || 0.15);
        const venueCommission = Math.round(gross * venueCommissionRate);
        const expenses = platformFee + venueCommission + refunds;
        const net = Math.round(gross - expenses);
        const settlementStatus = event.settlementStatus || (event.lifecycle === "completed" ? "pending" : "not_settled");

        const hostSettlementDoc = settlementsSnap.docs.find((settlementDoc) => settlementDoc.data()?.partnerType === "host");
        const hostSettlement = hostSettlementDoc ? (hostSettlementDoc.data() as PartnerSettlementRecord) : null;
        const hostEarnings = hostEarningsSnap && !hostEarningsSnap.empty ? hostEarningsSnap.docs[0].data() : null;
        const hostPayoutEstimate = Math.max(net, 0);
        const hostName =
            event.hostName ||
            event.host ||
            event.creatorName ||
            hostSettlement?.partnerName ||
            hostDoc?.data()?.brandName ||
            hostDoc?.data()?.name ||
            null;

        const promoterSettlementsByPartnerId = new Map<string, PartnerSettlementRecord & { id: string }>(
            settlementsSnap.docs
                .filter((settlementDoc) => settlementDoc.data()?.partnerType === "promoter")
                .map((settlementDoc) => {
                    const settlement = settlementDoc.data() as PartnerSettlementRecord;
                    return [String(settlement.partnerId || ""), { id: settlementDoc.id, ...settlement }];
                })
        );

        const promoterLinks = await listPromoterLinks({ eventId: id, limit: 200 });
        const promoterPayoutMap = promoterLinks.reduce((map, link) => {
            const promoterId = String(link.promoterId || "");
            if (!promoterId) return map;
            const settlement = promoterSettlementsByPartnerId.get(promoterId);
            const current = map.get(promoterId) || {
                assignmentId: link.id,
                promoterId,
                promoterName: link.promoterName || settlement?.partnerName || "Promoter",
                revenue: 0,
                sales: 0,
                clicks: 0,
                commissionRate: toNumber(link.commissionRate ?? 0),
                estimatedCommission: 0,
                status: settlement?.status || link.status || "not_started",
                paidAt: settlement?.settledAt || null,
                holdReason: settlement?.holdReason || null,
            };
            current.revenue += Math.round(toNumber(link.revenue || 0));
            current.sales += toNumber(link.conversions || 0);
            current.clicks += toNumber(link.clicks || 0);
            current.commissionRate = current.commissionRate || toNumber(link.commissionRate ?? 0);
            current.estimatedCommission += Math.round(
                toNumber(link.commission || (toNumber(link.revenue || 0) * (toNumber(link.commissionRate ?? 0) / 100)))
            );
            map.set(promoterId, current);
            return map;
        }, new Map<string, any>());

        const promoterPayouts = (promoterPayoutMap.size > 0
            ? [...promoterPayoutMap.values()]
            : promoterAssignmentsSnap.docs.map((assignmentDoc) => {
                const assignment = assignmentDoc.data();
                const promoterId = String(assignment.promoterId || "");
                const commissionRate = toNumber(assignment.commissionRate ?? 0);
                const revenueAttributed = toNumber(assignment.totalRevenue || 0);
                const estimatedCommission = Math.round(revenueAttributed * (commissionRate / 100));
                const settlement = promoterSettlementsByPartnerId.get(promoterId);

                return {
                    assignmentId: assignmentDoc.id,
                    promoterId,
                    promoterName: assignment.promoterName || settlement?.partnerName || "Promoter",
                    revenue: Math.round(revenueAttributed),
                    sales: toNumber(assignment.totalSales || 0),
                    clicks: toNumber(assignment.clicks || 0),
                    commissionRate,
                    estimatedCommission,
                    status: settlement?.status || assignment.status || (estimatedCommission > 0 ? "pending" : "not_started"),
                    paidAt: settlement?.settledAt || null,
                    holdReason: settlement?.holdReason || null,
                };
            }))
            .sort((a, b) => b.estimatedCommission - a.estimatedCommission);

        const promoterPayoutTotal = promoterPayouts.reduce((sum, payout) => sum + payout.estimatedCommission, 0);
        const promoterRevenueTotal = promoterPayouts.reduce((sum, payout) => sum + payout.revenue, 0);
        const promoterSalesTotal = promoterPayouts.reduce((sum, payout) => sum + payout.sales, 0);

        return NextResponse.json({
            gross: Math.round(gross),
            platformFee,
            venueCommission,
            venueCommissionRate,
            refundAmount: Math.round(refunds),
            expenses: Math.round(expenses),
            net,
            walkInRevenue: Math.round(walkInRevenue),
            walkInOrders,
            onlineRevenue: Math.round(onlineRevenue),
            onlineOrders,
            settlementStatus,
            paidAt: event.paidAt || null,
            paymentSources: [...paymentSources.values()].sort((a, b) => b.amount - a.amount),
            intakeChannels: [...intakeChannels.values()].sort((a, b) => b.amount - a.amount),
            ticketMix: [...ticketMix.values()].sort((a, b) => b.revenue - a.revenue),
            venueNetRevenue: Math.max(venueCommission - refunds, 0),
            hostPayout: event.hostId ? {
                hostId: String(event.hostId),
                hostName,
                estimate: hostPayoutEstimate,
                status: hostSettlement?.status || hostEarnings?.status || settlementStatus,
                paidAt: hostSettlement?.settledAt || hostEarnings?.paidAt || null,
                holdReason: hostSettlement?.holdReason || null,
                source: event.creatorRole === "host" || event.hostId ? "host_event" : "venue_event",
            } : null,
            promoterPayouts,
            payoutSummary: {
                hostEstimate: event.hostId ? hostPayoutEstimate : 0,
                promoterEstimate: promoterPayoutTotal,
                totalPartnerExposure: (event.hostId ? hostPayoutEstimate : 0) + promoterPayoutTotal,
                promoterRevenue: promoterRevenueTotal,
                promoterSales: promoterSalesTotal,
            },
            settlementLedger: {
                grossPaise: toPaise(gross),
                platformFeePaise: toPaise(platformFee),
                venueCommissionPaise: toPaise(venueCommission),
                refundsPaise: toPaise(refunds),
                hostPayoutPaise: toPaise(event.hostId ? hostPayoutEstimate : 0),
                promoterPayoutPaise: toPaise(promoterPayoutTotal),
            },
        });
    } catch (error: any) {
        console.error("[venue/events/[id]/finance]", error.message);
        return NextResponse.json({ error: "Failed to fetch event finance" }, { status: 500 });
    }
}
