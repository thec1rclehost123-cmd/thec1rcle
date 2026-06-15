/**
 * Finance Store (Refactored for API Governance)
 *
 * Uses the unified C1rcleApiClient to manage financial records.
 * All aggregation and DB access moved to @c1rcle/core/finance-engine via API Gateway.
 */

import { getApiClient } from './apiClient';

/**
 * Get financial breakdown for a specific event
 */
export async function getEventFinanceBreakdown(eventId, token) {
  const client = getApiClient(token);
  try {
    return await client.request(`/finance/summary?entityId=${eventId}&type=event`);
  } catch (error) {
    console.error('[FinanceStore] getEventFinanceBreakdown failed:', error.message);
    return {
      gross: 0,
      net: 0,
      commissions: 0,
      discounts: 0,
      fees: 0,
      payouts: [],
      auditStatus: 'error',
    };
  }
}

/**
 * Get transaction history for an entity
 */
export async function getTransactionHistory(entityId, options = {}, token) {
  const client = getApiClient(token);
  try {
    const query = new URLSearchParams({ entityId, ...options }).toString();
    return await client.request(`/finance/history?${query}`);
  } catch (error) {
    console.error('[FinanceStore] getTransactionHistory failed for', entityId, ':', error.message);
    return [];
  }
}

export default {
  getEventFinanceBreakdown,
  getTransactionHistory,
};
