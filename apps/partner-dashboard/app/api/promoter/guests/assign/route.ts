import { NextRequest, NextResponse } from "next/server";
import { requirePromoterAccess } from "@/lib/server/promoterAuthMiddleware";
import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { checkRateLimit } from "@/lib/server/rateLimit";

export async function POST(req: NextRequest) {
    const ctx = await requirePromoterAccess(req);
    if ("error" in ctx) return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
    
    // Rate limit: Max 5 requests per minute per IP or Promoter
    const identifier = req.headers.get("x-forwarded-for") || ctx.promoterId;
    if (!checkRateLimit(identifier, 5, 60000)) {
        return NextResponse.json({ success: false, case: "error", message: "Too many requests. Please try again later." }, { status: 429 });
    }

    try {
        const body = await req.json();
        const { orderId, eventId } = body;

        if (!orderId || !eventId) {
            return NextResponse.json({ success: false, case: "error", message: "Missing params" });
        }

        const db = getAdminDb();
        const orderRef = db.collection("orders").doc(orderId);
        
        const result = await db.runTransaction(async (t) => {
            const orderSnap = await t.get(orderRef);
            if (!orderSnap.exists) return "invalid";
            
            const order = orderSnap.data();
            if (order?.status !== "confirmed" && order?.status !== "completed") return "invalid";
            if (order.eventId !== eventId) return "wrong_event";
            if (order.promoterId) return "already_assigned";
            
            t.update(orderRef, {
                promoterId: ctx.promoterId,
                source: "manual",
                assignedBy: ctx.promoterId,
                assignedAt: FieldValue.serverTimestamp()
            });
            
            // Add to audit logs
            const auditRef = db.collection("promoter_audit_logs").doc();
            t.set(auditRef, {
                promoterId: ctx.promoterId,
                action: "MANUAL_GUEST_ASSIGNMENT",
                orderId: orderId,
                eventId: eventId,
                timestamp: FieldValue.serverTimestamp()
            });
            
            return "assigned";
        });
        
        return NextResponse.json({ success: true, case: result });
    } catch (err: any) {
        console.error("Assign error:", err);
        return NextResponse.json({ success: false, case: "error", message: err.message });
    }
}
