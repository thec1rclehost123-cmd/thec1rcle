/**
 * POST /api/events/[id]/cancel
 *
 * Dedicated cancellation endpoint that:
 *   1. Validates the actor has permission to cancel
 *   2. Updates event lifecycle to "cancelled"
 *   3. Dispatches Inngest workflow for bulk refund processing
 *   4. Returns immediate response (refunds happen asynchronously)
 */

import { NextRequest, NextResponse } from "next/server";
import { getEvent, updateEventLifecycle } from "@/lib/server/eventStore";
import { verifyPartnerAccess } from "@/lib/server/auth";

interface CancelRequest {
  actor: {
    uid: string;
    role: string;
    partnerId?: string;
    name?: string;
  };
  reason: string;
  refundPolicy: "full" | "partial" | "none";
  partialRefundPercent?: number;
  notes?: string;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const eventId = params.id;

  try {
    const body: CancelRequest = await req.json();
    const { actor, reason, refundPolicy = "full", partialRefundPercent, notes } = body;

    // ── Validate Actor ──
    if (!actor?.uid || !actor?.role) {
      return NextResponse.json(
        { error: "Actor information required (uid, role)" },
        { status: 400 },
      );
    }

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json({ error: "Cancellation reason is required" }, { status: 400 });
    }

    // ── Fetch Event ──
    const event = await getEvent(eventId);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // ── Check if already cancelled ──
    if (event.lifecycle === "cancelled") {
      return NextResponse.json(
        { error: "Event is already cancelled", alreadyCancelled: true },
        { status: 409 },
      );
    }

    // ── Authorization ──
    // Only event creator, venue owner, or admin can cancel
    const isCreator = event.creatorId === actor.uid;
    const isAdmin = actor.role === "admin";
    let isVenueManager = false;

    if (event.venueId && !isCreator && !isAdmin) {
      isVenueManager = await verifyPartnerAccess(req, event.venueId);
    }

    if (!isCreator && !isAdmin && !isVenueManager) {
      return NextResponse.json(
        { error: "Unauthorized: Only event creator, venue manager, or admin can cancel" },
        { status: 403 },
      );
    }

    // ── Update Event Lifecycle ──
    const now = new Date().toISOString();

    await updateEventLifecycle(
      eventId,
      "cancelled",
      actor,
      // Embed metadata in the notes passed to the lifecycle engine
      JSON.stringify({
        reason,
        notes,
        refundPolicy,
        partialRefundPercent,
        cancelledByName: actor.name || actor.uid,
      }),
    );

    // ── Dispatch Inngest Workflow ──
    let workflowDispatched = false;
    try {
      const { sendEvent, Events } = await import("@c1rcle/core/inngest-client");
      await sendEvent(
        Events.EVENT_CANCELLED,
        {
          eventId,
          eventTitle: event.title,
          cancellationReason: reason,
          cancelledBy: actor.uid,
          refundPolicy,
          partialRefundPercent: refundPolicy === "partial" ? partialRefundPercent : 100,
        },
        {
          idempotencyKey: `cancel-${eventId}-${Date.now()}`,
          user: { id: actor.uid },
        },
      );
      workflowDispatched = true;
      console.log(`[Cancel API] ✅ Inngest workflow dispatched for event ${eventId}`);
    } catch (error) {
      console.error("[Cancel API] ❌ Failed to dispatch Inngest workflow:", error);
      // Workflow failed to dispatch — refunds will need manual processing
    }

    // ── Response ──
    return NextResponse.json({
      success: true,
      eventId,
      lifecycle: "cancelled",
      refundPolicy,
      refundStatus: workflowDispatched ? "processing" : "manual_required",
      message: workflowDispatched
        ? "Event cancelled. Refunds are being processed automatically."
        : "Event cancelled. Refunds require manual processing (background job failed to start).",
    });
  } catch (error: any) {
    console.error("[Cancel API] Exception:", error);
    return NextResponse.json({ error: error.message || "Failed to cancel event" }, { status: 500 });
  }
}
