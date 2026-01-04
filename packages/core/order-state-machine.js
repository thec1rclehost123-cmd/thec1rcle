/**
 * THE C1RCLE - Order State Machine (Phase 1)
 * Production-grade state machine for order lifecycle management
 * 
 * Phase 1 States:
 *   draft → reserved → payment_pending → confirmed → checked_in
 *                                            ↓
 *                                    refund_requested → refunded
 * 
 * Note: Transfers, resale, chargebacks are Phase 2
 */

// Valid order statuses (Phase 1)
const ORDER_STATUSES = [
    'draft',
    'reserved',
    'payment_pending',
    'confirmed',
    'checked_in',
    'refund_requested',
    'refunded',
    'cancelled',
    'expired'
];

// Valid events that can trigger transitions (Phase 1)
const ORDER_EVENTS = [
    'RESERVE',
    'INITIATE_PAYMENT',
    'PAYMENT_SUCCESS',
    'PAYMENT_FAILED',
    'TIMEOUT',
    'EXPIRE',
    'CANCEL',
    'CHECK_IN',
    'REQUEST_REFUND',
    'APPROVE_REFUND',
    'REJECT_REFUND'
];

// State machine definition (Phase 1)
const STATE_MACHINE = {
    draft: {
        RESERVE: 'reserved',
        CANCEL: 'cancelled'
    },
    reserved: {
        INITIATE_PAYMENT: 'payment_pending',
        EXPIRE: 'expired',
        CANCEL: 'cancelled'
    },
    payment_pending: {
        PAYMENT_SUCCESS: 'confirmed',
        PAYMENT_FAILED: 'reserved',
        TIMEOUT: 'expired',
        CANCEL: 'cancelled'
    },
    confirmed: {
        CHECK_IN: 'checked_in',
        REQUEST_REFUND: 'refund_requested',
        CANCEL: 'cancelled'  // Admin only
    },
    checked_in: {
        REQUEST_REFUND: 'refund_requested'  // Post-entry refund possible with admin approval
    },
    refund_requested: {
        APPROVE_REFUND: 'refunded',
        REJECT_REFUND: 'confirmed'
    },
    refunded: {
        // Terminal state
    },
    cancelled: {
        // Terminal state
    },
    expired: {
        // Terminal state
    }
};

// Terminal states that cannot transition further
const TERMINAL_STATES = ['refunded', 'cancelled', 'expired'];

// Events that require admin authority
const ADMIN_ONLY_EVENTS = ['APPROVE_REFUND', 'REJECT_REFUND'];

// Events from states that require admin authority
const ADMIN_ONLY_TRANSITIONS = {
    confirmed: ['CANCEL'],
    checked_in: ['REQUEST_REFUND']
};

// Thresholds for dual approval (Phase 1)
const REFUND_THRESHOLDS = {
    AUTO_APPROVE: 500,       // Under ₹500 auto-approve
    SINGLE_APPROVAL: 5000,   // ₹500-5000 single admin
    DUAL_APPROVAL: 5000      // Over ₹5000 dual admin
};

/**
 * Check if a transition is valid
 */
export function canTransition(fromStatus, toStatus, event) {
    if (!ORDER_STATUSES.includes(fromStatus)) {
        return { valid: false, error: `Invalid source status: ${fromStatus}` };
    }

    if (!ORDER_STATUSES.includes(toStatus)) {
        return { valid: false, error: `Invalid target status: ${toStatus}` };
    }

    if (!ORDER_EVENTS.includes(event)) {
        return { valid: false, error: `Invalid event: ${event}` };
    }

    const stateTransitions = STATE_MACHINE[fromStatus];
    if (!stateTransitions) {
        return { valid: false, error: `No transitions defined for status: ${fromStatus}` };
    }

    const expectedTarget = stateTransitions[event];
    if (!expectedTarget) {
        return { valid: false, error: `Event ${event} not allowed in status ${fromStatus}` };
    }

    if (expectedTarget !== toStatus) {
        return { valid: false, error: `Event ${event} should transition to ${expectedTarget}, not ${toStatus}` };
    }

    return { valid: true };
}

/**
 * Get next status for an event
 */
export function getNextStatus(currentStatus, event) {
    const stateTransitions = STATE_MACHINE[currentStatus];
    if (!stateTransitions) {
        return null;
    }
    return stateTransitions[event] || null;
}

/**
 * Get all valid events for a status
 */
export function getValidEvents(status) {
    const stateTransitions = STATE_MACHINE[status];
    if (!stateTransitions) {
        return [];
    }
    return Object.keys(stateTransitions);
}

/**
 * Check if status is terminal
 */
export function isTerminalState(status) {
    return TERMINAL_STATES.includes(status);
}

/**
 * Check if event requires admin authority
 */
export function requiresAdminAuthority(status, event) {
    // Admin-only events always require admin
    if (ADMIN_ONLY_EVENTS.includes(event)) {
        return true;
    }

    // Specific transitions from certain states require admin
    const statusAdminEvents = ADMIN_ONLY_TRANSITIONS[status];
    if (statusAdminEvents && statusAdminEvents.includes(event)) {
        return true;
    }

    return false;
}

/**
 * Determine refund approval requirement based on amount
 */
export function getRefundApprovalRequirement(amount) {
    if (amount < REFUND_THRESHOLDS.AUTO_APPROVE) {
        return { type: 'auto', approversRequired: 0 };
    }

    if (amount < REFUND_THRESHOLDS.DUAL_APPROVAL) {
        return { type: 'single', approversRequired: 1 };
    }

    return { type: 'dual', approversRequired: 2 };
}

/**
 * Execute a state transition
 */
export function transition(order, event, actor, options = {}) {
    const { reason = '', metadata = {}, skipValidation = false } = options;

    const currentStatus = order.status;
    const nextStatus = getNextStatus(currentStatus, event);

    if (!nextStatus && !skipValidation) {
        throw new Error(`Invalid transition: Event ${event} not allowed in status ${currentStatus}`);
    }

    const now = new Date().toISOString();

    // Create status transition record
    const statusTransition = {
        from: currentStatus,
        to: nextStatus || currentStatus,
        event,
        timestamp: now,
        actor: {
            uid: actor.uid,
            role: actor.role,
            name: actor.name
        },
        reason,
        metadata
    };

    // Update order
    const updatedOrder = {
        ...order,
        status: nextStatus || currentStatus,
        statusHistory: [...(order.statusHistory || []), statusTransition],
        updatedAt: now
    };

    // Handle specific transitions
    switch (event) {
        case 'PAYMENT_SUCCESS':
            updatedOrder.confirmedAt = now;
            break;

        case 'CHECK_IN':
            updatedOrder.checkedInAt = now;
            updatedOrder.checkedInBy = actor.uid;
            // Also update ticket entry status if provided
            if (updatedOrder.tickets && metadata.ticketId) {
                updatedOrder.tickets = updatedOrder.tickets.map(t =>
                    t.id === metadata.ticketId
                        ? { ...t, entryStatus: 'checked_in', checkedInAt: now, checkedInBy: actor.uid }
                        : t
                );
            } else if (updatedOrder.tickets) {
                // Mark all tickets as checked in
                updatedOrder.tickets = updatedOrder.tickets.map(t => ({
                    ...t,
                    entryStatus: 'checked_in',
                    checkedInAt: now,
                    checkedInBy: actor.uid
                }));
            }
            break;

        case 'REQUEST_REFUND':
            updatedOrder.refundRequest = {
                requestedAt: now,
                requestedBy: actor.uid,
                reason: reason,
                amount: metadata.amount || order.totalAmount,
                status: 'pending'
            };
            break;

        case 'APPROVE_REFUND':
            if (updatedOrder.refundRequest) {
                updatedOrder.refundRequest.approvedAt = now;
                updatedOrder.refundRequest.approvedBy = actor.uid;
                updatedOrder.refundRequest.status = 'approved';
            }
            updatedOrder.refundedAt = now;
            break;

        case 'REJECT_REFUND':
            if (updatedOrder.refundRequest) {
                updatedOrder.refundRequest.rejectedAt = now;
                updatedOrder.refundRequest.rejectedBy = actor.uid;
                updatedOrder.refundRequest.rejectionReason = reason;
                updatedOrder.refundRequest.status = 'rejected';
            }
            break;

        case 'EXPIRE':
        case 'TIMEOUT':
            updatedOrder.expiredAt = now;
            break;

        case 'CANCEL':
            updatedOrder.cancelledAt = now;
            updatedOrder.cancelledBy = actor.uid;
            updatedOrder.cancellationReason = reason;
            break;
    }

    return updatedOrder;
}

/**
 * Validate a complete transition with all checks
 */
export function validateTransition(order, event, actor, options = {}) {
    const { amount = 0 } = options;
    const errors = [];
    const warnings = [];

    // Check basic validity
    const nextStatus = getNextStatus(order.status, event);
    if (!nextStatus) {
        errors.push(`Event ${event} not allowed in status ${order.status}`);
        return { valid: false, errors, warnings };
    }

    // Check admin authority
    if (requiresAdminAuthority(order.status, event)) {
        if (!actor.role || !['admin', 'super_admin', 'super'].includes(actor.role)) {
            errors.push(`Event ${event} requires admin authority`);
        }
    }

    // Event-specific validations
    switch (event) {
        case 'REQUEST_REFUND':
        case 'APPROVE_REFUND':
            // Check if payment was ever confirmed
            if (order.status !== 'confirmed' && order.status !== 'checked_in' && order.status !== 'refund_requested') {
                errors.push('Cannot refund order that was not confirmed');
            }

            // Check refund approval requirements
            if (event === 'APPROVE_REFUND') {
                const refundAmount = order.refundRequest?.amount || order.totalAmount;
                const requirement = getRefundApprovalRequirement(refundAmount);

                if (requirement.type === 'dual') {
                    warnings.push(`High-value refund (₹${refundAmount}) requires dual approval`);
                }
            }
            break;

        case 'CHECK_IN':
            if (order.status !== 'confirmed') {
                errors.push('Can only check in confirmed orders');
            }
            break;
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        nextStatus
    };
}

/**
 * Check if order can be refunded based on policy
 */
export function canRefund(order, event, refundPolicy = {}) {
    if (!['confirmed', 'checked_in'].includes(order.status)) {
        return { allowed: false, reason: 'Order is not in a refundable state' };
    }

    // Check if tier is refundable
    if (refundPolicy.type === 'non_refundable') {
        return { allowed: false, reason: 'This ticket type is non-refundable' };
    }

    // Check refund deadline
    if (refundPolicy.refundDeadlineHours && event) {
        const eventStart = new Date(event.startDate);
        const deadline = new Date(eventStart.getTime() - refundPolicy.refundDeadlineHours * 60 * 60 * 1000);

        if (new Date() > deadline) {
            return {
                allowed: false,
                reason: `Refund deadline was ${refundPolicy.refundDeadlineHours} hours before event`
            };
        }
    }

    // Check if already checked in (requires admin for post-entry refund)
    if (order.status === 'checked_in') {
        return {
            allowed: true,
            requiresAdmin: true,
            reason: 'Post-entry refund requires admin approval'
        };
    }

    return { allowed: true, requiresAdmin: false };
}

/**
 * Get human-readable status label
 */
export function getStatusLabel(status) {
    const labels = {
        draft: 'Draft',
        reserved: 'Reserved',
        payment_pending: 'Payment Pending',
        confirmed: 'Confirmed',
        checked_in: 'Checked In',
        refund_requested: 'Refund Requested',
        refunded: 'Refunded',
        cancelled: 'Cancelled',
        expired: 'Expired'
    };
    return labels[status] || status;
}

/**
 * Get status color for UI
 */
export function getStatusColor(status) {
    const colors = {
        draft: 'gray',
        reserved: 'yellow',
        payment_pending: 'orange',
        confirmed: 'green',
        checked_in: 'emerald',
        refund_requested: 'amber',
        refunded: 'red',
        cancelled: 'gray',
        expired: 'gray'
    };
    return colors[status] || 'gray';
}

// Export constants
export const STATUSES = ORDER_STATUSES;
export const EVENTS = ORDER_EVENTS;
export const MACHINE = STATE_MACHINE;
export const THRESHOLDS = REFUND_THRESHOLDS;

export default {
    canTransition,
    getNextStatus,
    getValidEvents,
    isTerminalState,
    requiresAdminAuthority,
    getRefundApprovalRequirement,
    transition,
    validateTransition,
    canRefund,
    getStatusLabel,
    getStatusColor,
    STATUSES: ORDER_STATUSES,
    EVENTS: ORDER_EVENTS,
    MACHINE: STATE_MACHINE,
    THRESHOLDS: REFUND_THRESHOLDS
};
