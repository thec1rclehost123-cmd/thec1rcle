'use client';

/**
 * useCancelEvent
 *
 * Hook for cancelling an event from the partner dashboard.
 * Calls the /api/events/[id]/cancel endpoint and tracks status.
 */

import { useState, useCallback } from 'react';

interface CancelEventInput {
  reason: string;
  refundPolicy: 'full' | 'partial' | 'none';
  partialRefundPercent?: number;
  notes: string;
}

interface CancelEventResult {
  success: boolean;
  eventId?: string;
  lifecycle?: string;
  refundPolicy?: string;
  refundStatus?: string;
  message?: string;
  error?: string;
}

interface UseCancelEventOptions {
  onSuccess?: (result: CancelEventResult) => void;
  onError?: (error: string) => void;
}

export function useCancelEvent(
  eventId: string,
  actor: { uid: string; role: string; partnerId?: string; name?: string },
  options: UseCancelEventOptions = {},
) {
  const [isCancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CancelEventResult | null>(null);

  const cancelEvent = useCallback(
    async (input: CancelEventInput) => {
      setCancelling(true);
      setError(null);

      try {
        const response = await fetch(`/api/events/${eventId}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actor,
            reason: input.reason,
            refundPolicy: input.refundPolicy,
            partialRefundPercent: input.partialRefundPercent,
            notes: input.notes,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          const errMsg = data.error || 'Failed to cancel event';
          setError(errMsg);
          options.onError?.(errMsg);
          throw new Error(errMsg);
        }

        setResult(data);
        options.onSuccess?.(data);
        return data;
      } catch (err: any) {
        const errMsg = err.message || 'An unexpected error occurred';
        setError(errMsg);
        throw err;
      } finally {
        setCancelling(false);
      }
    },
    [eventId, actor, options],
  );

  return {
    cancelEvent,
    isCancelling,
    error,
    result,
  };
}
