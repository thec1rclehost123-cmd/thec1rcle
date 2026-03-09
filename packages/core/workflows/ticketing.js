import { inngest, Events } from "../inngest-client.js";
import { getAdminDb } from "../admin.js";
import { generateEntitlementQR, issueEntitlements } from "../entitlement-engine.js";

/**
 * Dead-letter handler: called after a ticketing workflow exhausts all retries.
 * Writes a record to `fulfillment_failures` so ops can observe and reprocess.
 */
export const handleTicketFulfillmentFailure = inngest.createFunction(
    { id: "ticket-fulfillment-on-failure" },
    { event: "inngest/function.failed" },
    async ({ event }) => {
        if (event.data.function_id !== "ticket-fulfillment-pipeline") return;
        const db = getAdminDb();
        const { orderId, eventId, userId } = event.data.event?.data || {};
        await db.collection("fulfillment_failures").add({
            functionId: event.data.function_id,
            runId: event.data.run_id,
            orderId: orderId ?? null,
            eventId: eventId ?? null,
            userId: userId ?? null,
            error: event.data.error?.message ?? "unknown",
            failedAt: new Date().toISOString(),
            status: "pending_review"
        });
    }
);

/**
 * PRODUCTION WORKFLOW: Ticket Fulfillment Pipeline
 * 
 * Triggered after payment confirmation. Handles all post-purchase work:
 * 1. Issue entitlements (QR codes)
 * 2. Generate ticket PDF
 * 3. Send confirmation email
 * 4. Notify promoter (if applicable)
 * 5. Update analytics
 * 
 * Each step is independently retriable with automatic backoff.
 */
export const handleTicketFulfillment = inngest.createFunction(
    {
        id: "ticket-fulfillment-pipeline",
        name: "Ticket Fulfillment Pipeline",
        retries: 5, // Retry up to 5 times on failure
        throttle: {
            limit: 100, // Max 100 concurrent executions
            period: "1m",
            key: "event.data.eventId", // Per-event throttling
        },
    },
    { event: Events.TICKET_PURCHASED },
    async ({ event, step }) => {
        const { orderId, userId, userEmail, eventId, tickets, totalAmount, promoterCode } = event.data;
        const db = getAdminDb();

        // Step 1: Issue entitlements and generate QR codes
        const entitlements = await step.run("issue-entitlements", async () => {
            const order = { id: orderId, userId, eventId };
            const items = tickets.map(t => ({
                ticketId: t.tierId,
                name: t.tierName,
                quantity: t.quantity,
                entryType: t.entryType || 'general',
                genderRequirement: t.genderRequirement
            }));

            const issuedEntitlements = await issueEntitlements(order, items);

            // Generate QR payloads for each entitlement
            return issuedEntitlements.map(ent => ({
                ...ent,
                qrPayload: generateEntitlementQR(ent.id)
            }));
        });

        // Step 2: Update order with entitlement IDs
        await step.run("link-entitlements-to-order", async () => {
            await db.collection("orders").doc(orderId).update({
                entitlementIds: entitlements.map(e => e.id),
                fulfilledAt: new Date().toISOString(),
                fulfillmentStatus: "completed"
            });
            return { linked: entitlements.length };
        });

        // Step 3: Generate PDF ticket (placeholder - integrate with PDF service)
        const pdfResult = await step.run("generate-ticket-pdf", async () => {
            // In production, call your PDF generation service (e.g., Puppeteer, PDFKit, or external API)
            // For now, we return a placeholder URL
            const pdfUrl = `https://c1rcle.com/api/tickets/${orderId}/download`;

            // Store PDF reference
            await db.collection("orders").doc(orderId).update({
                ticketPdfUrl: pdfUrl,
                pdfGeneratedAt: new Date().toISOString()
            });

            return { pdfUrl };
        });

        // Step 4: Send confirmation email via your email service
        await step.run("send-confirmation-email", async () => {
            // Fetch event details for email
            const eventDoc = await db.collection("events").doc(eventId).get();
            const eventData = eventDoc.exists ? eventDoc.data() : null;

            if (!eventData || !userEmail) {
                return { skipped: true, reason: "Missing event data or email" };
            }

            // Import and call your existing email function
            // This is a dynamic import since email service may not be in core
            const emailPayload = {
                to: userEmail,
                templateId: "ticket_confirmation",
                data: {
                    orderId,
                    eventName: eventData.title,
                    eventDate: eventData.startDate,
                    eventLocation: eventData.location,
                    ticketCount: entitlements.length,
                    totalAmount,
                    pdfUrl: pdfResult.pdfUrl,
                    qrCodes: entitlements.map(e => e.qrPayload)
                }
            };

            // Log the email attempt (actual sending should use your email provider)
            await db.collection("email_queue").add({
                ...emailPayload,
                status: "pending",
                createdAt: new Date().toISOString()
            });

            return { queued: true, to: userEmail };
        });

        // Step 5: Credit promoter if applicable
        if (promoterCode) {
            await step.run("credit-promoter-commission", async () => {
                const promoDoc = await db.collection("promo_codes")
                    .where("code", "==", promoterCode)
                    .limit(1)
                    .get();

                if (promoDoc.empty) return { skipped: true, reason: "Promo code not found" };

                const promo = promoDoc.docs[0].data();
                const promoterId = promo.promoterId;
                const commissionRate = promo.commissionRate || 0.10; // 10% default

                const commission = Math.round(totalAmount * commissionRate * 100) / 100;

                // Add to promoter ledger
                await db.collection("promoter_ledger").add({
                    promoterId,
                    orderId,
                    eventId,
                    promoCode: promoterCode,
                    orderAmount: totalAmount,
                    commissionRate,
                    commissionAmount: commission,
                    status: "pending", // Will be settled after event
                    createdAt: new Date().toISOString()
                });

                // Increment promoter stats
                await db.collection("promoters").doc(promoterId).update({
                    totalSales: db.FieldValue.increment(totalAmount),
                    totalOrders: db.FieldValue.increment(1),
                    pendingCommission: db.FieldValue.increment(commission)
                });

                return { credited: true, promoterId, commission };
            });
        }

        // Step 6: Update real-time analytics
        await step.run("update-analytics", async () => {
            const now = new Date();
            const dateKey = now.toISOString().split("T")[0]; // YYYY-MM-DD

            // Atomic increment on event stats
            await db.collection("event_analytics").doc(`${eventId}_${dateKey}`).set({
                eventId,
                date: dateKey,
                ticketsSold: db.FieldValue.increment(entitlements.length),
                revenue: db.FieldValue.increment(totalAmount),
                ordersCount: db.FieldValue.increment(1),
                updatedAt: db.FieldValue.serverTimestamp()
            }, { merge: true });

            return { updated: true };
        });

        // Return final status
        return {
            status: "fulfilled",
            orderId,
            entitlementCount: entitlements.length,
            emailSent: true,
            fulfilledAt: new Date().toISOString()
        };
    }
);

/**
 * PRODUCTION WORKFLOW: Event Reminder Notifications
 * 
 * Scheduled to run 2 hours before event start.
 * Sends push notifications and emails to all ticket holders.
 */
export const sendEventReminders = inngest.createFunction(
    {
        id: "send-event-reminders",
        name: "Event Reminder Notifications",
        retries: 3,
    },
    { event: Events.REMINDER_SCHEDULED },
    async ({ event, step }) => {
        const { eventId, eventName, eventDate, venueAddress } = event.data;
        const db = getAdminDb();

        // Get all confirmed orders for this event
        const orders = await step.run("fetch-attendees", async () => {
            const snapshot = await db.collection("orders")
                .where("eventId", "==", eventId)
                .where("status", "==", "confirmed")
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                userEmail: doc.data().userEmail,
                userId: doc.data().userId,
                userName: doc.data().userName
            }));
        });

        // Send reminders in batches
        const batchSize = 50;
        for (let i = 0; i < orders.length; i += batchSize) {
            const batch = orders.slice(i, i + batchSize);

            await step.run(`send-reminder-batch-${Math.floor(i / batchSize)}`, async () => {
                for (const order of batch) {
                    await db.collection("notification_queue").add({
                        userId: order.userId,
                        email: order.userEmail,
                        type: "event_reminder",
                        title: `${eventName} starts in 2 hours!`,
                        body: `Don't forget! ${eventName} at ${venueAddress}`,
                        data: { eventId, orderId: order.id },
                        status: "pending",
                        scheduledFor: new Date().toISOString()
                    });
                }
                return { sent: batch.length };
            });
        }

        return {
            status: "reminders_queued",
            eventId,
            recipientCount: orders.length
        };
    }
);

/**
 * PRODUCTION WORKFLOW: Post-Event Settlement
 * 
 * Runs after an event ends to:
 * 1. Finalize attendance stats
 * 2. Calculate payouts for venue/host/promoters
 * 3. Generate settlement summary
 */
export const processEventSettlement = inngest.createFunction(
    {
        id: "process-event-settlement",
        name: "Post-Event Settlement",
        retries: 5,
    },
    { event: Events.EVENT_ENDED },
    async ({ event, step }) => {
        const { eventId } = event.data;
        const db = getAdminDb();

        // Step 1: Finalize attendance
        const attendance = await step.run("finalize-attendance", async () => {
            const entitlements = await db.collection("entitlements")
                .where("eventId", "==", eventId)
                .get();

            const stats = {
                total: entitlements.size,
                consumed: 0,
                noShow: 0
            };

            entitlements.docs.forEach(doc => {
                const data = doc.data();
                if (data.state === "CONSUMED") stats.consumed++;
                else stats.noShow++;
            });

            return stats;
        });

        // Step 2: Calculate revenue
        const revenue = await step.run("calculate-revenue", async () => {
            const orders = await db.collection("orders")
                .where("eventId", "==", eventId)
                .where("status", "==", "confirmed")
                .get();

            let total = 0;
            let platformFees = 0;
            let taxCollected = 0;

            orders.docs.forEach(doc => {
                const data = doc.data();
                total += data.totalAmount || 0;
                platformFees += data.platformFee || 0;
                taxCollected += data.taxAmount || 0;
            });

            return { total, platformFees, taxCollected, orderCount: orders.size };
        });

        // Step 3: Queue payouts
        await step.run("queue-payouts", async () => {
            const eventDoc = await db.collection("events").doc(eventId).get();
            const eventData = eventDoc.data();

            const hostPayout = revenue.total - revenue.platformFees - revenue.taxCollected;

            await db.collection("payout_queue").add({
                eventId,
                recipientId: eventData.hostId,
                recipientType: "host",
                grossAmount: revenue.total,
                platformFees: revenue.platformFees,
                netAmount: hostPayout,
                status: "pending_review",
                createdAt: new Date().toISOString()
            });

            return { hostPayout };
        });

        // Step 4: Mark promoter commissions as ready for payout
        await step.run("finalize-promoter-commissions", async () => {
            const commissions = await db.collection("promoter_ledger")
                .where("eventId", "==", eventId)
                .where("status", "==", "pending")
                .get();

            const batch = db.batch();
            commissions.docs.forEach(doc => {
                batch.update(doc.ref, {
                    status: "ready_for_payout",
                    finalizedAt: new Date().toISOString()
                });
            });
            await batch.commit();

            return { promoterCommissions: commissions.size };
        });

        // Step 5: Create settlement summary
        await step.run("create-settlement-summary", async () => {
            await db.collection("event_settlements").doc(eventId).set({
                eventId,
                attendance,
                revenue,
                status: "completed",
                settledAt: new Date().toISOString()
            });
            return { recorded: true };
        });

        return {
            status: "settled",
            eventId,
            attendance,
            revenue
        };
    }
);
