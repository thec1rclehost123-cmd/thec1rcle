'use client';

import { useQuery } from '@tanstack/react-query';
import { guestApi, getApiErrorMessage } from '../../../lib/api/client';

export const checkoutPaymentConfigQueryKey = ['checkout', 'payment-config'];

export async function fetchCheckoutPaymentConfig() {
  const { response, data } = await guestApi.payments.config();
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, 'Failed to load payment config'));
  }
  return data;
}

export function usePaymentConfigQuery(options = {}) {
  return useQuery({
    queryKey: checkoutPaymentConfigQueryKey,
    queryFn: fetchCheckoutPaymentConfig,
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    ...options,
  });
}
