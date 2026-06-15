/**
 * Promo Code Service (Refactored for API Governance)
 *
 * Uses the unified C1rcleApiClient to manage promo codes.
 * All validation and DB access moved to @c1rcle/core/promo-service via API Gateway.
 */

import { getApiClient } from './apiClient';

/**
 * Get all promo codes for an event
 */
export async function getEventPromoCodes(eventId, options = {}, token) {
  const client = getApiClient(token);
  try {
    return await client.getEventPromos(eventId);
  } catch (error) {
    console.error('[PromoCodeService] getEventPromoCodes failed:', error.message);
    return [];
  }
}

/**
 * Validate a promo code (Proxy to API Gateway)
 */
export async function validatePromoCode(eventId, code, userId, items, token) {
  const client = getApiClient(token);
  return client.validatePromo(eventId, code, userId, items);
}

/**
 * Create a new promo code (Proxy to API Gateway)
 */
export async function createPromoCode(eventId, codeData, token) {
  const client = getApiClient(token);
  return client.request('/promos/create', {
    method: 'POST',
    body: JSON.stringify({ eventId, ...codeData }),
  });
}

export default {
  getEventPromoCodes,
  validatePromoCode,
  createPromoCode,
};
