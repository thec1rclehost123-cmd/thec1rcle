'use client';

import { getApiErrorMessage, guestApi } from '../../../lib/api/client';

export async function fetchGuestOrder(orderId, options = {}) {
  return guestApi.orders.get(orderId, options);
}

export async function getOrderCancelEligibility(orderId) {
  const { response, data } = await guestApi.orders.cancelEligibility(orderId);
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, 'Failed to check cancellation eligibility'));
  }
  return data;
}

export async function cancelGuestOrder(orderId, reason) {
  const { response, data } = await guestApi.orders.cancel(orderId, {
    reason: reason || 'User requested cancellation',
  });
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, 'Failed to cancel order'));
  }
  return data;
}
