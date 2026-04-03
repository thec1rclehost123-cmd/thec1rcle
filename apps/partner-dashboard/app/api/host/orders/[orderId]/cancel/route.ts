import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
import { getAdminDb } from "@/lib/firebase/admin";
import { appendOpsLog, buildOpsLogEntry, getOrderDocumentById, normalizeOrderRecord } from "@/lib/server/orderTracking";

const cancelSchema = z.object({
    mode: z.enum(["cancel", "cancel_and_relist"]).default("cancel"),
    note: z.string().trim().max(500).optional(),
});

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ orderId: string }> }
) {
    const { orderId } = await params;

    let parsedBody;
    try {
        parsedBody = cancelSchema.parse(await request.json().catch(() => ({})));
    } catch (error: any) {
        return NextResponse.json({ error: error?.issues?.[0]?.message || "Invalid request body" }, { status: 400 });
    }

    const ctx = await requireHostAccess(
        request,
        parsedBody.mode === "cancel_and_relist" ? "MANAGE_EVENTS" : "MANAGE_EVENTS"
    );
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    try {
        const db = getAdminDb();
        const resolved = await getOrderDocumentById(db, orderId);
        if (!resolved) return NextResponse.json({ error: "Order not found" }, { status: 404 });

        const order = normalizeOrderRecord(resolved.doc, resolved.source);
        const rawOrder = resolved.doc.data() || {};
        const eventDoc = await db.collection("events").doc(String(rawOrder.eventId || "")).get();
        const event = eventDoc.data() || {};
        const ownsEvent = event.hostId === ctx.hostId || event.creatorId === ctx.hostId;
        if (rawOrder.hostId !== ctx.hostId && !ownsEvent) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (["cancelled", "refunded"].includes(order.status)) {
            return NextResponse.json({ error: "Order is already closed" }, { status: 409 });
        }

        const now = new Date().toISOString();
        const opsEntry = buildOpsLogEntry({
            type: "order_cancelled",
            actorUid: ctx.uid,
            actorName: ctx.role,
            note: parsedBody.note || null,
            mode: parsedBody.mode,
        });

        await db.runTransaction(async (transaction) => {
            const orderSnap = await transaction.get(resolved.doc.ref);
            if (!orderSnap.exists) throw new Error("Order not found");

            const latestOrder = orderSnap.data() || {};
            if (["cancelled", "refunded"].includes(String(latestOrder.status || ""))) {
                return;
            }

            const [bundlesSnap, assignmentsSnap, entitlementsSnap] = await Promise.all([
                transaction.get(db.collection("share_bundles").where("orderId", "==", orderId)),
                transaction.get(db.collection("ticket_assignments").where("orderId", "==", orderId)),
                transaction.get(db.collection("entitlements").where("orderId", "==", orderId)),
            ]);

            if (parsedBody.mode === "cancel_and_relist" && resolved.source === "ticket") {
                const eventRef = db.collection("events").doc(String(latestOrder.eventId || ""));
                const eventSnap = await transaction.get(eventRef);
                if (eventSnap.exists) {
                    const eventData = eventSnap.data() || {};
                    const usesTicketCatalog = Boolean(eventData.ticketCatalog);
                    const sourceTiers = usesTicketCatalog
                        ? [...(eventData.ticketCatalog?.tiers || [])]
                        : [...(eventData.tickets || [])];

                    for (const orderTicket of latestOrder.tickets || []) {
                        const tierIndex = sourceTiers.findIndex((tier: any) => tier.id === orderTicket.ticketId);
                        if (tierIndex < 0) continue;

                        const currentTier = sourceTiers[tierIndex];
                        const inventory = currentTier.inventory || {};

                        if (inventory.soldQuantity !== undefined) {
                            sourceTiers[tierIndex] = {
                                ...currentTier,
                                inventory: {
                                    ...inventory,
                                    soldQuantity: Math.max(0, Number(inventory.soldQuantity || 0) - Number(orderTicket.quantity || 1)),
                                },
                            };
                        } else {
                            sourceTiers[tierIndex] = {
                                ...currentTier,
                                remaining: Number(currentTier.remaining ?? currentTier.quantity ?? 0) + Number(orderTicket.quantity || 1),
                            };
                        }
                    }

                    if (usesTicketCatalog) {
                        transaction.update(eventRef, {
                            "ticketCatalog.tiers": sourceTiers,
                            updatedAt: now,
                        });
                    } else {
                        transaction.update(eventRef, {
                            tickets: sourceTiers,
                            updatedAt: now,
                        });
                    }
                }
            }

            const baseUpdate = appendOpsLog(
                {
                    status: "cancelled",
                    cancelledAt: now,
                    cancelledBy: ctx.uid,
                    cancelledByRole: ctx.role,
                    cancellationMode: parsedBody.mode,
                    cancellationNote: parsedBody.note || null,
                    inventoryRelisted: parsedBody.mode === "cancel_and_relist",
                    refundStatus: Number(latestOrder.totalAmount || 0) > 0 ? "manual_review_required" : "not_applicable",
                },
                opsEntry
            );

            transaction.update(resolved.doc.ref, baseUpdate);
            transaction.set(
                db.collection("latest_orders_feed").doc(orderId),
                {
                    status: "cancelled",
                    updatedAt: now,
                    writtenAt: now,
                },
                { merge: true }
            );

            bundlesSnap.forEach((doc) => {
                transaction.update(doc.ref, { status: "cancelled", updatedAt: now });
            });
            assignmentsSnap.forEach((doc) => {
                transaction.update(doc.ref, { status: "voided", updatedAt: now });
            });
            entitlementsSnap.forEach((doc) => {
                transaction.update(doc.ref, {
                    state: "REVOKED",
                    revokedAt: now,
                    revokedReason: "ORDER_CANCELLED",
                    revokedBy: ctx.uid,
                });
            });
        });

        return NextResponse.json({
            success: true,
            orderId,
            orderNumber: order.orderNumber,
            mode: parsedBody.mode,
        });
    } catch (error: any) {
        console.error("[host/orders/[orderId]/cancel]", error?.message || error);
        return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
    }
}
