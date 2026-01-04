/**
 * THE C1RCLE - Refund Service (Phase 1)
 * Service module for refund requests with admin approval workflow
 * Location: apps/partner-dashboard/lib/server/refundService.js
 */

import { randomUUID } from "node:crypto";
import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import { restoreInventory } from "./inventoryService";

// Refund thresholds (in INR)
const REFUND_THRESHOLDS = {
    AUTO_APPROVE: 500,       // Under ₹500: auto-approve
    SINGLE_APPROVAL: 5000,   // ₹500-5000: single admin approval
    DUAL_APPROVAL: 5000      // Over ₹5000: dual admin approval
};

// Collection names
const REFUND_REQUESTS_COLLECTION = "refund_requests";
const ORDERS_COLLECTION = "orders";

// In-memory fallback
const fallbackRefundRequests = new Map();

/**
 * Check if order can be refunded based on policy
 */
export function canRefund(order, event, tier = null) {
    const result = {
        allowed: false,
        reason: null,
        requiresAdmin: false,
        autoApprove: false
    };

    // Check order status
    if (!['confirmed', 'checked_in'].includes(order.status)) {
        result.reason = 'Order is not in a refundable state';
        return result;
    }

    // Already refunded or pending
    if (order.status === 'refunded' || order.status === 'refund_requested') {
        result.reason = 'Refund already requested or processed';
        return result;
    }

    // Check tier refund policy
    if (tier) {
        if (!tier.refundable && tier.refundable !== undefined) {
            result.reason = 'This ticket type is non-refundable';
            return result;
        }

        // Check refund deadline
        if (tier.refundDeadlineHours && event) {
            const eventStart = new Date(event.startDate || event.date);
            const deadline = new Date(eventStart.getTime() - tier.refundDeadlineHours * 60 * 60 * 1000);

            if (new Date() > deadline) {
                result.reason = `Refund deadline was ${tier.refundDeadlineHours} hours before event`;
                return result;
            }
        }
    }

    // Post-entry refund requires admin
    if (order.status === 'checked_in') {
        result.allowed = true;
        result.requiresAdmin = true;
        result.reason = 'Post-entry refund requires admin approval';
        return result;
    }

    result.allowed = true;
    return result;
}

/**
 * Determine approval requirements for a refund amount
 */
export function getApprovalRequirement(amount) {
    if (amount < REFUND_THRESHOLDS.AUTO_APPROVE) {
        return {
            type: 'auto',
            approversRequired: 0,
            description: 'Auto-approved (under threshold)'
        };
    }

    if (amount < REFUND_THRESHOLDS.DUAL_APPROVAL) {
        return {
            type: 'single',
            approversRequired: 1,
            description: 'Requires single admin approval'
        };
    }

    return {
        type: 'dual',
        approversRequired: 2,
        description: 'Requires dual admin approval'
    };
}

/**
 * Create a refund request
 */
export async function createRefundRequest(orderId, requestedBy, options = {}) {
    const {
        reason = '',
        amount = null,
        source = 'user'  // 'user', 'host', 'admin'
    } = options;

    // Get order details
    const order = await getOrder(orderId);
    if (!order) {
        return { success: false, error: 'Order not found' };
    }

    // Validate refund is allowed
    const canRefundResult = canRefund(order, null);
    if (!canRefundResult.allowed) {
        return { success: false, error: canRefundResult.reason };
    }

    // Determine amount
    const refundAmount = amount ?? order.totalAmount;
    const isPartial = refundAmount < order.totalAmount;

    // Determine approval requirement
    const approvalReq = getApprovalRequirement(refundAmount);
    const autoApprove = approvalReq.type === 'auto' && !canRefundResult.requiresAdmin;

    const now = new Date().toISOString();
    const idempotencyKey = `refund:${orderId}:${Date.now()}`;

    const refundRequest = {
        id: randomUUID(),
        orderId,
        eventId: order.eventId,
        customerId: order.customerId || order.userId,
        amount: refundAmount,
        isPartial,
        reason,
        source,
        requestedBy: {
            uid: requestedBy.uid,
            role: requestedBy.role,
            name: requestedBy.name
        },

        status: autoApprove ? 'approved' : 'pending',
        approvalType: approvalReq.type,
        approversRequired: approvalReq.approversRequired,
        approvers: autoApprove ? [{ uid: 'system', role: 'system', at: now }] : [],

        paymentDetails: {
            originalPaymentId: order.payment?.razorpayPaymentId,
            razorpayRefundId: null
        },

        idempotencyKey,
        createdAt: now,
        updatedAt: now
    };

    if (!isFirebaseConfigured()) {
        fallbackRefundRequests.set(refundRequest.id, refundRequest);
    } else {
        const db = getAdminDb();
        await db.collection(REFUND_REQUESTS_COLLECTION).doc(refundRequest.id).set(refundRequest);
    }

    // If auto-approved, process immediately
    if (autoApprove) {
        const processResult = await processRefund(refundRequest.id);
        return {
            success: true,
            refundRequest: { ...refundRequest, ...processResult },
            autoApproved: true
        };
    }

    // Update order status to refund_requested
    await updateOrderStatus(orderId, 'refund_requested', {
        refundRequestId: refundRequest.id,
        refundAmount
    });

    return {
        success: true,
        refundRequest,
        autoApproved: false,
        approvalRequired: approvalReq
    };
}

/**
 * Approve a refund request (admin action)
 */
export async function approveRefundRequest(refundRequestId, approver) {
    const refundRequest = await getRefundRequest(refundRequestId);
    if (!refundRequest) {
        return { success: false, error: 'Refund request not found' };
    }

    if (refundRequest.status !== 'pending') {
        return { success: false, error: `Refund is already ${refundRequest.status}` };
    }

    // Check approver permission
    if (!['admin', 'super_admin', 'super'].includes(approver.role)) {
        return { success: false, error: 'Only admins can approve refunds' };
    }

    // Check for duplicate approver (for dual approval)
    if (refundRequest.approvers.some(a => a.uid === approver.uid)) {
        return { success: false, error: 'You have already approved this refund' };
    }

    const now = new Date().toISOString();
    const updatedApprovers = [
        ...refundRequest.approvers,
        { uid: approver.uid, role: approver.role, name: approver.name, at: now }
    ];

    // Check if we have enough approvals
    const isFullyApproved = updatedApprovers.length >= refundRequest.approversRequired;

    const updates = {
        approvers: updatedApprovers,
        status: isFullyApproved ? 'approved' : 'pending',
        updatedAt: now
    };

    if (isFullyApproved) {
        updates.approvedAt = now;
    }

    await updateRefundRequest(refundRequestId, updates);

    // If fully approved, process the refund
    if (isFullyApproved) {
        const processResult = await processRefund(refundRequestId);
        return {
            success: true,
            approved: true,
            processed: processResult.success,
            message: processResult.success ? 'Refund processed successfully' : processResult.error
        };
    }

    return {
        success: true,
        approved: false,
        pendingApprovals: refundRequest.approversRequired - updatedApprovers.length,
        message: `Approval recorded. ${refundRequest.approversRequired - updatedApprovers.length} more approval(s) required.`
    };
}

/**
 * Reject a refund request (admin action)
 */
export async function rejectRefundRequest(refundRequestId, rejector, reason) {
    const refundRequest = await getRefundRequest(refundRequestId);
    if (!refundRequest) {
        return { success: false, error: 'Refund request not found' };
    }

    if (refundRequest.status !== 'pending') {
        return { success: false, error: `Refund is already ${refundRequest.status}` };
    }

    // Check rejector permission
    if (!['admin', 'super_admin', 'super'].includes(rejector.role)) {
        return { success: false, error: 'Only admins can reject refunds' };
    }

    const now = new Date().toISOString();

    await updateRefundRequest(refundRequestId, {
        status: 'rejected',
        rejectedBy: {
            uid: rejector.uid,
            role: rejector.role,
            name: rejector.name
        },
        rejectionReason: reason,
        rejectedAt: now,
        updatedAt: now
    });

    // Update order back to confirmed
    await updateOrderStatus(refundRequest.orderId, 'confirmed', {
        refundRejected: true,
        refundRejectionReason: reason
    });

    return { success: true, message: 'Refund request rejected' };
}

/**
 * Process an approved refund (actually execute refund via payment gateway)
 */
export async function processRefund(refundRequestId) {
    const refundRequest = await getRefundRequest(refundRequestId);
    if (!refundRequest) {
        return { success: false, error: 'Refund request not found' };
    }

    if (refundRequest.status !== 'approved') {
        return { success: false, error: 'Refund not approved' };
    }

    const now = new Date().toISOString();

    // Mark as processing
    await updateRefundRequest(refundRequestId, {
        status: 'processing',
        processingStartedAt: now,
        updatedAt: now
    });

    try {
        // Process via Razorpay
        const razorpayRefundId = await executeRazorpayRefund(
            refundRequest.paymentDetails.originalPaymentId,
            refundRequest.amount,
            refundRequest.idempotencyKey
        );

        // Update refund request
        await updateRefundRequest(refundRequestId, {
            status: 'completed',
            'paymentDetails.razorpayRefundId': razorpayRefundId,
            processedAt: now,
            updatedAt: now
        });

        // Update order status
        await updateOrderStatus(refundRequest.orderId, 'refunded', {
            refundRequestId,
            refundAmount: refundRequest.amount,
            razorpayRefundId
        });

        // Restore inventory
        const order = await getOrder(refundRequest.orderId);
        if (order?.items || order?.tickets) {
            await restoreInventory(
                order.eventId,
                (order.items || order.tickets).map(i => ({
                    tierId: i.tierId || i.ticketId,
                    quantity: i.quantity
                }))
            );
        }

        return { success: true, razorpayRefundId };

    } catch (error) {
        console.error('[RefundService] Refund processing failed:', error);

        // Mark as failed
        await updateRefundRequest(refundRequestId, {
            status: 'failed',
            failureReason: error.message,
            updatedAt: now
        });

        return { success: false, error: error.message };
    }
}

/**
 * Execute refund via Razorpay
 */
async function executeRazorpayRefund(paymentId, amount, idempotencyKey) {
    // Import Razorpay when needed (lazy load)
    let Razorpay;
    try {
        Razorpay = (await import('razorpay')).default;
    } catch (e) {
        console.warn('[RefundService] Razorpay not available, using mock');
        // Return mock refund ID for development
        return `rfnd_mock_${Date.now()}`;
    }

    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!razorpayKeyId || !razorpayKeySecret) {
        console.warn('[RefundService] Razorpay credentials missing, using mock');
        return `rfnd_mock_${Date.now()}`;
    }

    const razorpay = new Razorpay({
        key_id: razorpayKeyId,
        key_secret: razorpayKeySecret
    });

    // Create refund with idempotency
    const refund = await razorpay.payments.refund(paymentId, {
        amount: amount * 100, // Razorpay expects paise
        speed: 'normal',
        notes: {
            idempotency_key: idempotencyKey
        }
    });

    return refund.id;
}

/**
 * Get refund request by ID
 */
async function getRefundRequest(refundRequestId) {
    if (!isFirebaseConfigured()) {
        return fallbackRefundRequests.get(refundRequestId) || null;
    }

    const db = getAdminDb();
    const doc = await db.collection(REFUND_REQUESTS_COLLECTION).doc(refundRequestId).get();

    if (!doc.exists) {
        return null;
    }

    return { id: doc.id, ...doc.data() };
}

/**
 * Update refund request
 */
async function updateRefundRequest(refundRequestId, updates) {
    if (!isFirebaseConfigured()) {
        const existing = fallbackRefundRequests.get(refundRequestId);
        if (existing) {
            fallbackRefundRequests.set(refundRequestId, { ...existing, ...updates });
        }
        return;
    }

    const db = getAdminDb();
    await db.collection(REFUND_REQUESTS_COLLECTION).doc(refundRequestId).update(updates);
}

/**
 * Get order by ID
 */
async function getOrder(orderId) {
    if (!isFirebaseConfigured()) {
        return null;
    }

    const db = getAdminDb();
    const doc = await db.collection(ORDERS_COLLECTION).doc(orderId).get();

    if (!doc.exists) {
        return null;
    }

    return { id: doc.id, ...doc.data() };
}

/**
 * Update order status
 */
async function updateOrderStatus(orderId, status, metadata = {}) {
    if (!isFirebaseConfigured()) {
        return;
    }

    const db = getAdminDb();
    await db.collection(ORDERS_COLLECTION).doc(orderId).update({
        status,
        ...metadata,
        updatedAt: new Date().toISOString()
    });
}

/**
 * Get pending refund requests for admin review
 */
export async function getPendingRefundRequests(options = {}) {
    const { limit = 50, eventId = null } = options;

    if (!isFirebaseConfigured()) {
        const pending = Array.from(fallbackRefundRequests.values())
            .filter(r => r.status === 'pending')
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return pending.slice(0, limit);
    }

    const db = getAdminDb();
    let query = db.collection(REFUND_REQUESTS_COLLECTION)
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'desc')
        .limit(limit);

    if (eventId) {
        query = query.where('eventId', '==', eventId);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get refund history for an order
 */
export async function getOrderRefundHistory(orderId) {
    if (!isFirebaseConfigured()) {
        return Array.from(fallbackRefundRequests.values())
            .filter(r => r.orderId === orderId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    const db = getAdminDb();
    const snapshot = await db.collection(REFUND_REQUESTS_COLLECTION)
        .where('orderId', '==', orderId)
        .orderBy('createdAt', 'desc')
        .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export default {
    canRefund,
    getApprovalRequirement,
    createRefundRequest,
    approveRefundRequest,
    rejectRefundRequest,
    processRefund,
    getPendingRefundRequests,
    getOrderRefundHistory,
    REFUND_THRESHOLDS
};
