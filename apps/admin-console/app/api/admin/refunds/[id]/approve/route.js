/**
 * THE C1RCLE - Admin Refund Approval/Rejection API
 * Approve or reject individual refund requests
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

        if (!isFirebaseConfigured()) {
            return NextResponse.json({
                success: true,
                message: 'Refund approved (mock)',
                approved: true
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

        // Check if admin already approved
        if (refundData.approvers?.some(a => a.uid === admin.uid)) {
            return NextResponse.json(
                { error: "You have already approved this refund" },
                { status: 400 }
            );
        }

        const now = new Date().toISOString();
        const newApprovers = [
            ...(refundData.approvers || []),
            { uid: admin.uid, name: admin.name || admin.email, role: admin.role, at: now }
        ];

        const isFullyApproved = newApprovers.length >= (refundData.approversRequired || 1);

        // Update refund request
        await refundRef.update({
            approvers: newApprovers,
            status: isFullyApproved ? 'approved' : 'pending',
            updatedAt: now,
            ...(isFullyApproved && { approvedAt: now })
        });

        // If fully approved, update order status and trigger refund processing
        if (isFullyApproved) {
            await db.collection(ORDERS_COLLECTION).doc(refundData.orderId).update({
                status: 'refunded',
                refundedAt: now,
                refundAmount: refundData.amount
            });

            // TODO: Trigger actual Razorpay refund via refundService
        }

        // Audit log
        await logAuditAction({
            action: 'refund_approved',
            targetType: 'refund_request',
            targetId: refundId,
            adminId: admin.uid,
            adminEmail: admin.email,
            details: {
                orderId: refundData.orderId,
                amount: refundData.amount,
                fullyApproved: isFullyApproved
            }
        });

        return NextResponse.json({
            success: true,
            approved: isFullyApproved,
            pendingApprovals: isFullyApproved ? 0 : (refundData.approversRequired - newApprovers.length),
            message: isFullyApproved
                ? 'Refund approved and processing'
                : `Approval recorded. ${refundData.approversRequired - newApprovers.length} more needed.`
        });

    } catch (error) {
        console.error("POST /api/admin/refunds/[id]/approve error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to approve refund" },
            { status: 500 }
        );
    }
}
