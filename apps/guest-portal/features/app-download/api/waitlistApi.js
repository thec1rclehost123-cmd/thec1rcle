'use client';

import { getApiErrorMessage, guestApi } from '../../../lib/api/client';

export async function joinAppWaitlist(email) {
  const { response, data } = await guestApi.waitlist.join({ email, eventId: 'app_launch' });
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, 'Failed to join waitlist'));
  }
  return data;
}
