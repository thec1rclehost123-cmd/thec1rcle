/**
 * Refund Service (Refactored for API Governance)
 *
 * Pure business logic helpers + SDK delegates.
 * All DB access and Razorpay integration moved to API Gateway's /refunds routes.
 */

import { getApiClient } from './apiClient';

// Refund thresholds (in INR) - kept for client-side UI checks
export const REFUND_THRESHOLDS = {
  AUTO_APPROVE: 500,
  SINGLE_APPROVAL: 5000,
  DUAL_APPROVAL: 5000,
};

/**
 * Check if an order can be refunded based on policy (pure logic, no DB call)
 */
export function canRefund(order, event = null, tier = null) {
  const result = { allowed: false, reason: null, requiresAdmin: false };

  if (!['confirmed', 'checked_in'].includes(order?.status)) {
    result.reason = 'Order is not in a refundable state';
    return result;
  }

  if (order.status === 'refunded' || order.status === 'refund_requested') {
    result.reason = 'Refund already requested or processed';
    return result;
  }

  if (tier && !tier.refundable && tier.refundable !== undefined) {
    result.reason = 'This ticket type is non-refundable';
    return result;
  }

  if (tier?.refundDeadlineHours && event) {
    const deadline = new Date(
      new Date(event.startDate || event.date).getTime() - tier.refundDeadlineHours * 3600_000,
    );
    if (new Date() > deadline) {
      result.reason = `Refund deadline was ${tier.refundDeadlineHours} hours before event`;
      return result;
    }
  }

  if (order.status === 'checked_in') {
    result.allowed = true;
    result.requiresAdmin = true;
    result.reason = 'Post-entry refund requires admin approval';
    return result;
  }

  result.allowed = true;
  return result;
}

export function getApprovalRequirement(amount) {
  if (amount < REFUND_THRESHOLDS.AUTO_APPROVE) return { type: 'auto', approversRequired: 0 };
  if (amount < REFUND_THRESHOLDS.DUAL_APPROVAL) return { type: 'single', approversRequired: 1 };
  return { type: 'dual', approversRequired: 2 };
}

export async function createRefundRequest(orderId, requestedBy, options = {}, token) {
  const client = getApiClient(token);
  const { reason = '', amount = null, source = 'user' } = options;
  return client.requestRefund(orderId, reason, amount, source);
}

export async function approveRefundRequest(refundRequestId, token) {
  const client = getApiClient(token);
  return client.respondToRefund(refundRequestId, 'approve');
}

export async function rejectRefundRequest(refundRequestId, reason, token) {
  const client = getApiClient(token);
  return client.respondToRefund(refundRequestId, 'reject', reason);
}

export async function getPendingRefundRequests(options = {}, token) {
  const client = getApiClient(token);
  try {
    return await client.getPendingRefunds(options);
  } catch (error) {
    console.error('[RefundService] getPendingRefundRequests failed:', error.message);
    return [];
  }
}

export async function getOrderRefundHistory(orderId, token) {
  const client = getApiClient(token);
  try {
    return await client.getOrderRefundHistory(orderId);
  } catch (error) {
    console.error('[RefundService] getOrderRefundHistory failed:', error.message);
    return [];
  }
}

export default {
  canRefund,
  getApprovalRequirement,
  createRefundRequest,
  approveRefundRequest,
  rejectRefundRequest,
  getPendingRefundRequests,
  getOrderRefundHistory,
  REFUND_THRESHOLDS,
};
