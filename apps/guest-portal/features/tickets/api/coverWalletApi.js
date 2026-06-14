"use client";

import { getApiErrorMessage, guestApi } from "../../../lib/api/client";

export async function fetchCoverChargeWallet(walletId) {
  const { response, data } = await guestApi.tickets.coverChargeWallet(walletId);
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, "Unable to load cover wallet"));
  }
  return data;
}
