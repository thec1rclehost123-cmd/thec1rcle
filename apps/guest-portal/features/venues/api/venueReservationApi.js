"use client";

import { getApiErrorMessage, guestApi } from "../../../lib/api/client";

export async function createVenueReservation(body) {
  const { response, data } = await guestApi.venues.reserve(body);
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, "Reservation failed"));
  }
  return data;
}
