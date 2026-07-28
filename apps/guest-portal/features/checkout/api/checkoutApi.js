'use client';

import { getApiErrorMessage, guestApi } from '../../../lib/api/client';
import {
  getGuestBffErrorMessage,
  guestBffJson,
  unwrapGuestBffPayload,
} from '../../../lib/bff/client.js';
import { getGuestBffFlags, isGuestBffEnabled } from '../../../lib/bff/flags.js';
import { logGuestBffParity } from '../../../lib/bff/parity.js';

async function request(requestFn, fallbackMessage) {
  const { response, data } = await requestFn();
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, fallbackMessage));
  }
  return data;
}

export function calculateCheckout(body, options = {}) {
  if (isGuestBffEnabled('checkout')) {
    return guestBffJson('/checkout/quote', {
      method: 'POST',
      headers: options.headers,
      body,
    }).then(async ({ response, data }) => {
      const payload = unwrapGuestBffPayload(data) || {};
      const nextData = {
        success: Boolean(payload?.success),
        pricing: payload?.pricing || null,
        quote: payload?.quote || null,
        reservation: payload?.reservation || null,
        error: data?.error?.message || payload?.error || data?.error || null,
        constraints: payload?.constraints || null,
      };

      if (getGuestBffFlags().parity) {
        try {
          const legacy = await guestApi.checkout.calculate(body, options);
          if (legacy?.response?.ok) {
            logGuestBffParity('checkout.quote', legacy.data, nextData, {
              eventId: options.eventId || body?.eventId || null,
            });
          }
        } catch {}
      }

      return {
        response: response.ok
          ? response
          : new Response(JSON.stringify(nextData), {
              status: response.status || 422,
              headers: {
                'Content-Type': 'application/json',
              },
            }),
        data: nextData,
      };
    });
  }

  return guestApi.checkout.calculate(body, options);
}

export function validateCheckoutPromo(body, options = {}) {
  return guestApi.checkout.promo(body, options);
}

export async function reserveCheckoutInventory(body, options = {}) {
  if (isGuestBffEnabled('checkout')) {
    const { response, data } = await guestBffJson('/checkout/reserve', {
      method: 'POST',
      headers: options.headers,
      body,
    });
    if (!response.ok) {
      throw new Error(getGuestBffErrorMessage(data, 'Failed to reserve tickets'));
    }
    return unwrapGuestBffPayload(data);
  }
  return request(() => guestApi.checkout.reserve(body, options), 'Failed to reserve tickets');
}

export async function initiateCheckout(body, options = {}) {
  if (isGuestBffEnabled('checkout')) {
    const { response, data } = await guestBffJson('/checkout/initiate', {
      method: 'POST',
      headers: options.headers,
      body,
    });
    if (!response.ok) {
      throw new Error(getGuestBffErrorMessage(data, 'Failed to initiate checkout'));
    }
    return unwrapGuestBffPayload(data);
  }
  return request(() => guestApi.checkout.initiate(body, options), 'Failed to initiate checkout');
}

export async function verifyCheckoutPayment(body, options = {}) {
  if (isGuestBffEnabled('checkout')) {
    const { response, data } = await guestBffJson('/checkout/verify', {
      method: 'POST',
      headers: options.headers,
      body,
    });
    if (!response.ok) {
      throw new Error(getGuestBffErrorMessage(data, 'Verification failed'));
    }
    return unwrapGuestBffPayload(data);
  }
  return request(() => guestApi.payments.verify(body, options), 'Verification failed');
}

export async function fetchCheckoutOrderStatus(orderId, options = {}) {
  if (isGuestBffEnabled('checkout')) {
    const query = new URLSearchParams({ orderId }).toString();
    const { response, data } = await guestBffJson(`/checkout/recover?${query}`, {
      headers: options.headers,
    });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(getGuestBffErrorMessage(data, 'Failed to load order status'));
    }
    return unwrapGuestBffPayload(data)?.order || null;
  }

  const { response, data } = await guestApi.orders.get(orderId, {
    ...options,
    query: {
      includeEvent: 'false',
      ...(options.query || {}),
    },
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, 'Failed to load order status'));
  }
  return data?.order || null;
}
