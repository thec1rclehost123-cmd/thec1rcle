"use client";

import { getApiErrorMessage, guestApi } from "../../../lib/api/client";

async function request(requestFn, fallbackMessage) {
  const { response, data } = await requestFn();
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, fallbackMessage));
  }
  return data;
}

export function calculateCheckout(body, options = {}) {
  return guestApi.checkout.calculate(body, options);
}

export function validateCheckoutPromo(body, options = {}) {
  return guestApi.checkout.promo(body, options);
}

export async function reserveCheckoutInventory(body, options = {}) {
  return request(() => guestApi.checkout.reserve(body, options), "Failed to reserve tickets");
}

export async function initiateCheckout(body, options = {}) {
  return request(() => guestApi.checkout.initiate(body, options), "Failed to initiate checkout");
}

export async function verifyCheckoutPayment(body, options = {}) {
  return request(() => guestApi.payments.verify(body, options), "Verification failed");
}

export async function fetchCheckoutOrderStatus(orderId, options = {}) {
  const { response, data } = await guestApi.orders.get(orderId, options);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, "Failed to load order status"));
  }
  return data?.order || null;
}
