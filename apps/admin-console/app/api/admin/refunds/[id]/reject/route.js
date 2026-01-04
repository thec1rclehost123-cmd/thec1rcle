/**
 * THE C1RCLE - Admin Refund Rejection API
 * Reject a refund request with reason
 */

import { NextResponse } from "next/server";
import { getAdminDb, isFirebaseConfigured } from "../../../../../../lib/firebase/admin";
import { verifyAuth as verifyAdminAuth } from "../../../../../../lib/server/auth";
import { logAdminAction as logAuditAction } from "../../../../../../lib/server/audit";

const REFUND_REQUESTS_COLLECTION = "refund_requests";
const ORDERS_COLLECTION = "orders";

export async function POST(request, { params }) {
    try {
        // Verify admin authentication
        const admin = await verifyAdminAuth(request);
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const refundId = params.id;
        const body = await request.json();
        const { reason } = body;

        if (!reason) {
            return NextResponse.json(
                { error: "Rejection reason is required" },
                { status: 400 }
            );
        }

        if (!isFirebaseConfigured()) {
            return NextResponse.json({
                success: true,
                message: 'Refund rejected (mock)'
            });
        }

        const db = getAdminDb();
        const refundRef = db.collection(REFUND_REQUESTS_COLLECTION).doc(refundId);
        const refundDoc = await refundRef.get();

        if (!refundDoc.exists) {
            return NextResponse.json(
                { error: "Refund request not found" },
                { status: 404 }
            );
        }

        const refundData = refundDoc.data();

        if (refundData.status !== 'pending') {
            return NextResponse.json(
                { error: `Refund is already ${refundData.status}` },
                { status: 400 }
            );
        }

        const now = new Date().toISOString();

        // Update refund request
        await refundRef.update({
            status: 'rejected',
            rejectedBy: {
                uid: admin.uid,
                name: admin.name || admin.email,
                role: admin.role
            },
            rejectionReason: reason,
            rejectedAt: now,
            updatedAt: now
        });

        // Update order status back to confirmed
        await db.collection(ORDERS_COLLECTION).doc(refundData.orderId).update({
            status: 'confirmed',
            refundRejected: true,
            refundRejectionReason: reason,
            updatedAt: now
        });

        // Audit log
        await logAuditAction({
            action: 'refund_rejected',
            targetType: 'refund_request',
            targetId: refundId,
            adminId: admin.uid,
            adminEmail: admin.email,
            details: {
                orderId: refundData.orderId,
                amount: refundData.amount,
                reason
            }
        });

        return NextResponse.json({
            success: true,
            message: 'Refund request rejected'
        });

    } catch (error) {
        console.error("POST /api/admin/refunds/[id]/reject error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to reject refund" },
            { status: 500 }
        );
    }
}
